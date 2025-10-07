/**
 * Contacts Sync Command - True Bidirectional Sync with LLM-based Deduplication
 * Implements comprehensive sync logic with UUID matching, conflict resolution, and ChatGPT-4 deduplication
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { DatabaseConnection } from '../../database/connection.js';
import { DatabaseOperations } from '../../database/operations.js';
import { entityToVCard } from '../../vcard/mapper.js';
import { generateVCard } from '../../vcard/generator.js';
import { parseVCard } from '../../vcard/parser.js';
import { vcardToEntity, validateVCard } from '../../vcard/mapper.js';
import { createEntity } from '../../models/index.js';
import type { Entity } from '../../types/base.js';
import { EntityType, ImportanceLevel } from '../../types/enums.js';
import { colors, icons } from '../colors.js';
import { loadUserConfig } from '../claude-desktop.js';
import type { UserConfig } from '../../types/sync-config.js';
import { DEFAULT_SYNC_CONFIG } from '../../types/sync-config.js';

// Import sync utilities
import {
  matchContacts,
  extractMcpUuid,
  findPotentialDuplicates,
  type MatchPair,
  type PotentialDuplicatePair,
} from '../../utils/contact-matching.js';
import {
  checkDuplication,
  batchCheckDuplicates,
  entityToContactInfo,
  vcardToContactInfo,
  type ContactPair,
  type DuplicationCheckResult,
} from '../../utils/deduplication.js';
import {
  resolveConflict,
  hasConflict,
  type SyncConflict,
  type ConflictResolution,
} from '../../utils/conflict-resolution.js';
import type { VCardData } from '../../vcard/types.js';

const execAsync = promisify(exec);

export interface ContactsSyncOptions {
  userId: string;
  direction: 'export' | 'import' | 'both';
  dryRun?: boolean;
  autoMerge?: boolean;
  threshold?: number;
  noLlm?: boolean;
}

export interface ContactsSyncResult {
  success: boolean;
  exported: number;
  imported: number;
  updated: number;
  merged: number;
  failed: number;
  skipped: number;
  errors: string[];
  duplicatesFound: number;
}

/**
 * Check if running on macOS
 */
function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * Ensure Contacts.app is running and ready
 * This prevents "Application isn't running" (-600) errors
 */
async function ensureContactsAppRunning(): Promise<void> {
  try {
    const launchScript = `
      tell application "Contacts"
        launch
        activate
      end tell

      -- Wait for app to be ready
      delay 1
    `;

    await execAsync(`osascript -e '${launchScript}'`, {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });

    console.log(colors.dim('  Contacts.app launched and ready'));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to launch Contacts.app: ${errorMsg}`);
  }
}

/**
 * Count contacts with retry logic
 * Retries up to maxRetries times if Contacts.app fails to respond
 */
async function countContactsWithRetry(maxRetries: number = 3): Promise<number> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const countScript = `
        tell application "Contacts"
          launch
          activate
          delay 0.5
          count people
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${countScript}'`, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });

      return parseInt(stdout.trim(), 10);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (attempt === maxRetries) {
        throw new Error(
          `Failed to count contacts after ${maxRetries} attempts: ${errorMsg}`
        );
      }

      console.log(colors.dim(`  Retry ${attempt}/${maxRetries}...`));
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new Error('Failed to count contacts');
}

/**
 * Get all contacts from macOS Contacts as vCards (with batch loading)
 */
async function getMacOSContacts(): Promise<VCardData[]> {
  console.log(`${icons.cycle} Counting macOS contacts...`);

  // Ensure Contacts.app is launched and ready
  await ensureContactsAppRunning();

  // Use retry logic for counting
  const totalCount = await countContactsWithRetry();

  if (totalCount === 0) {
    return [];
  }

  console.log(`  Found ${totalCount} contacts, loading in batches...`);

  const batchSize = 50; // Process 50 contacts at a time (optimized for performance)
  const results: VCardData[] = [];

  // Load in batches
  for (let i = 1; i <= totalCount; i += batchSize) {
    const endIndex = Math.min(i + batchSize - 1, totalCount);

    const batchScript = `
      tell application "Contacts"
        set vcardData to ""
        repeat with j from ${i} to ${endIndex}
          set vcardData to vcardData & vcard of person j
        end repeat
        return vcardData
      end tell
    `;

    try {
      const { stdout } = await execAsync(`osascript -e '${batchScript}'`, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 300000, // 5 minute timeout for large batches
      });

      if (stdout && stdout.trim().length > 0) {
        const batch = parseVCard(stdout);
        results.push(...batch);
      }

      // Progress indicator
      process.stdout.write(`\r  Loaded ${results.length}/${totalCount} contacts...`);
    } catch (error) {
      console.error(`\n  Warning: Failed to load batch ${i}-${endIndex}: ${error}`);
      // Continue with next batch
    }
  }

  console.log(''); // New line after progress
  console.log(`${icons.success} Loaded ${results.length} contacts from macOS`);

  return results;
}

/**
 * Batch export contacts to macOS Contacts (more efficient than individual exports)
 */
async function batchExportToMacOS(vcards: VCardData[], batchSize: number = 50): Promise<void> {
  const totalCount = vcards.length;

  for (let i = 0; i < totalCount; i += batchSize) {
    const batch = vcards.slice(i, i + batchSize);

    // Process batch in parallel (up to a limit)
    const promises = batch.map(vcard => upsertMacOSContact(vcard));
    await Promise.all(promises);

    // Progress indicator
    const processed = Math.min(i + batchSize, totalCount);
    process.stdout.write(`\r  Exported ${processed}/${totalCount} contacts...`);
  }

  console.log(''); // New line after progress
}

/**
 * Create or update contact in macOS Contacts via AppleScript
 */
async function upsertMacOSContact(vcard: VCardData, existingUuid?: string): Promise<void> {
  const firstName = vcard.n?.givenName || vcard.fn.split(' ')[0] || '';
  const lastName = vcard.n?.familyName || vcard.fn.split(' ').slice(1).join(' ') || '';
  const email = vcard.email?.[0] || '';
  const phone = vcard.tel?.[0] || '';
  const org = vcard.org || '';
  const title = vcard.title || '';

  // Build notes with MCP-UUID
  let notes = vcard.note || '';
  const mcpUuid = vcard['x-mcp-uuid'];
  if (mcpUuid && !notes.includes(`[MCP-UUID: ${mcpUuid}]`)) {
    notes = notes ? `${notes}\n\n[MCP-UUID: ${mcpUuid}]` : `[MCP-UUID: ${mcpUuid}]`;
  }

  // If existingUuid, try to update existing contact
  // Note: macOS Contacts doesn't have a great API for updating by UUID
  // We'll create a new contact and rely on macOS's built-in duplicate detection
  const script = `
    tell application "Contacts"
      launch
      activate
      delay 0.5
      set newPerson to make new person with properties {first name:"${escapeAppleScript(firstName)}", last name:"${escapeAppleScript(lastName)}"}
      ${email ? `make new email at end of emails of newPerson with properties {value:"${escapeAppleScript(email)}", label:"work"}` : ''}
      ${phone ? `make new phone at end of phones of newPerson with properties {value:"${escapeAppleScript(phone)}", label:"work"}` : ''}
      ${org ? `set organization of newPerson to "${escapeAppleScript(org)}"` : ''}
      ${title ? `set job title of newPerson to "${escapeAppleScript(title)}"` : ''}
      ${notes ? `set note of newPerson to "${escapeAppleScript(notes)}"` : ''}
      save
    end tell
  `;

  await execAsync(`osascript -e '${script}'`, {
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    timeout: 60000, // 1 minute timeout for individual contact operations
  });
}

/**
 * Escape special characters for AppleScript
 * Order matters: backslashes first, then quotes, then newlines
 */
function escapeAppleScript(text: string): string {
  if (!text) return '';

  return text
    // Escape backslashes first (must be first to avoid double-escaping!)
    .replace(/\\/g, '\\\\')
    // Escape double quotes (for property values in AppleScript)
    .replace(/"/g, '\\"')
    // Escape single quotes/apostrophes (CRITICAL: breaks shell command if not escaped)
    .replace(/'/g, "\\'")
    // Escape newlines for multi-line strings
    .replace(/\n/g, '\\n')
    // Escape carriage returns
    .replace(/\r/g, '\\r');
}

/**
 * Sync matched contact pairs (compare timestamps and update older)
 */
async function syncMatchedPair(
  pair: MatchPair,
  dbOps: DatabaseOperations,
  config: UserConfig,
  dryRun: boolean
): Promise<{ action: 'updated_mcp' | 'updated_external' | 'merged' | 'no_change'; updated: boolean }> {
  // Check if there's a conflict
  if (!hasConflict(pair.mcp, pair.external)) {
    return { action: 'no_change', updated: false };
  }

  // Resolve conflict
  const conflict: SyncConflict = {
    mcpEntity: pair.mcp,
    externalContact: pair.external,
    mcpModified: pair.mcp.updatedAt ? new Date(pair.mcp.updatedAt) : undefined,
    // External contacts don't have modification timestamps in vCard standard
    // We'll rely on the conflict resolution strategy
  };

  const syncConfig = config.sync || DEFAULT_SYNC_CONFIG;
  const resolution = resolveConflict(conflict, syncConfig.conflictResolution);

  if (resolution.action === 'skip') {
    console.log(`${colors.dim('⊘')} Skipped (manual resolution required): ${pair.mcp.name}`);
    return { action: 'no_change', updated: false };
  }

  if (dryRun) {
    // Reduced logging - no per-contact output in dry run for matched pairs
    return { action: resolution.action as any, updated: true };
  }

  if (resolution.action === 'use_mcp') {
    // Update external contact from MCP
    const vcard = entityToVCard(pair.mcp);
    await upsertMacOSContact(vcard, pair.mcp.id ? String(pair.mcp.id) : undefined);
    return { action: 'updated_external', updated: true };
  } else if (resolution.action === 'use_external') {
    // Update MCP entity from external
    const entityData = vcardToEntity(pair.external, pair.mcp.userId!, {
      entityType: pair.mcp.entityType,
      importance: pair.mcp.importance,
      tags: pair.mcp.tags,
    });

    // Update existing entity
    if (pair.mcp.id) {
      await dbOps.updateEntity(String(pair.mcp.id), entityData, pair.mcp.userId!);
    }
    return { action: 'updated_mcp', updated: true };
  } else if (resolution.action === 'merge' && resolution.mergedData) {
    // Merge both sides
    // Update MCP with merged data
    if (pair.mcp.id) {
      await dbOps.updateEntity(String(pair.mcp.id), resolution.mergedData, pair.mcp.userId!);
    }

    // Update external with merged data
    const mergedVCard = entityToVCard({ ...pair.mcp, ...resolution.mergedData } as Entity);
    await upsertMacOSContact(mergedVCard, pair.mcp.id ? String(pair.mcp.id) : undefined);

    return { action: 'merged', updated: true };
  }

  return { action: 'no_change', updated: false };
}

/**
 * Process duplicate pairs found by LLM
 */
async function processDuplicates(
  potentialPairs: PotentialDuplicatePair[],
  userId: string,
  dbOps: DatabaseOperations,
  config: UserConfig,
  dryRun: boolean,
  autoMerge: boolean
): Promise<{ merged: number; failed: number; skipped: number }> {
  const result = { merged: 0, failed: 0, skipped: 0 };

  if (potentialPairs.length === 0) {
    return result;
  }

  console.log(
    `\n${icons.magnify} ${colors.title(`Checking ${potentialPairs.length} potential duplicates with LLM...`)}`
  );

  // Convert to ContactPairs for LLM check
  const contactPairs: ContactPair[] = potentialPairs.map(p => ({
    contact1: entityToContactInfo(p.mcp),
    contact2: vcardToContactInfo(p.external),
  }));

  const syncConfig = config.sync || DEFAULT_SYNC_CONFIG;

  // Batch check with LLM
  const llmResults = await batchCheckDuplicates(
    contactPairs,
    syncConfig.deduplication,
    config.openaiApiKey,
    (current, total) => {
      process.stdout.write(`\r  Progress: ${current}/${total} checked...`);
    }
  );

  console.log('\n'); // New line after progress

  // Process results (with reduced logging)
  let notDuplicates = 0;
  let duplicatesFound = 0;

  for (let i = 0; i < potentialPairs.length; i++) {
    const pair = potentialPairs[i];
    const llmResult = llmResults[i];

    if (!llmResult.isDuplicate || llmResult.confidence < syncConfig.deduplication.threshold) {
      notDuplicates++;
      result.skipped++;
      continue;
    }

    duplicatesFound++;

    if (!autoMerge) {
      result.skipped++;
      continue;
    }

    try {
      if (dryRun) {
        result.merged++;
      } else {
        // Merge: Update external contact with MCP UUID
        const mcpVCard = entityToVCard(pair.mcp);
        await upsertMacOSContact(mcpVCard, pair.mcp.id ? String(pair.mcp.id) : undefined);

        // Also update MCP entity with any additional info from external
        const conflict: SyncConflict = {
          mcpEntity: pair.mcp,
          externalContact: pair.external,
        };
        const resolution = resolveConflict(conflict, syncConfig.conflictResolution);

        if (resolution.action === 'merge' && resolution.mergedData && pair.mcp.id) {
          await dbOps.updateEntity(String(pair.mcp.id), resolution.mergedData, pair.mcp.userId!);
        }

        result.merged++;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.failed++;
    }
  }

  // Summary logging instead of per-contact
  console.log(`  ${icons.success} Duplicates identified: ${duplicatesFound}`);
  console.log(`  ${colors.dim('○')} Not duplicates: ${notDuplicates}`);

  return result;
}

/**
 * Main sync function with true bidirectional sync logic
 */
export async function syncContacts(options: ContactsSyncOptions): Promise<ContactsSyncResult> {
  const { userId, direction, dryRun = false, autoMerge, threshold, noLlm } = options;

  // Check if running on macOS
  if (!isMacOS()) {
    throw new Error('Contacts sync is only available on macOS');
  }

  console.log(`\n${icons.robot} ${colors.title('macOS Contacts Sync - Bidirectional')}`);
  console.log(`${colors.dim('User:')} ${userId}`);
  console.log(`${colors.dim('Direction:')} ${direction}`);
  console.log(`${colors.dim('Dry run:')} ${dryRun ? 'YES' : 'NO'}`);

  const result: ContactsSyncResult = {
    success: true,
    exported: 0,
    imported: 0,
    updated: 0,
    merged: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    duplicatesFound: 0,
  };

  // Load config for sync settings
  const config = loadUserConfig();
  if (!config) {
    throw new Error('Configuration not found. Run "mcp-memory init" first.');
  }

  // Override config with command-line options
  const syncConfig = config.sync || DEFAULT_SYNC_CONFIG;
  if (autoMerge !== undefined) {
    syncConfig.conflictResolution.autoMerge = autoMerge;
  }
  if (threshold !== undefined) {
    syncConfig.deduplication.threshold = threshold;
  }
  if (noLlm) {
    syncConfig.deduplication.enableLLMDeduplication = false;
  }

  console.log(
    `${colors.dim('Deduplication:')} ${syncConfig.deduplication.enableLLMDeduplication ? 'LLM-based' : 'Rule-based'} (threshold: ${syncConfig.deduplication.threshold}%)`
  );
  console.log(
    `${colors.dim('Conflict resolution:')} ${syncConfig.conflictResolution.strategy} ${syncConfig.conflictResolution.autoMerge ? '(auto-merge)' : ''}`
  );

  // Connect to database
  const dbUrl = process.env.TURSO_URL || config.tursoUrl;
  const authToken = process.env.TURSO_AUTH_TOKEN || config.tursoAuthToken;

  if (!dbUrl || !authToken) {
    throw new Error('TURSO_URL and TURSO_AUTH_TOKEN are required');
  }

  const db = new DatabaseConnection({
    url: dbUrl,
    authToken,
  });
  await db.connect();

  const dbOps = new DatabaseOperations(db);

  try {
    // Get user
    let user = await dbOps.getUserByEmail(userId);
    if (!user) {
      user = await dbOps.getUserById(userId);
    }

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    console.log(`${icons.success} Found user: ${user.email} (${user.id})\n`);

    // PHASE 1: Load contacts from both sides
    console.log(`${icons.cycle} ${colors.title('Loading contacts...')}`);

    const mcpEntities = await dbOps.getEntitiesByUserId(user.id, 10000);
    const peopleEntities = mcpEntities.filter(e => e.entityType === EntityType.PERSON);
    console.log(`  MCP entities: ${peopleEntities.length}`);

    const macContacts = direction === 'export' ? [] : await getMacOSContacts();
    console.log(`  macOS contacts: ${macContacts.length}`);

    // PHASE 2: Match by UUID and other identifiers
    if (direction === 'both' || direction === 'import') {
      console.log(`\n${icons.cycle} ${colors.title('Matching contacts...')}`);

      const matchResult = matchContacts(peopleEntities, macContacts);

      console.log(`  Matched (by UID): ${matchResult.matched.filter(m => m.matchType === 'uid').length}`);
      console.log(`  Matched (by email): ${matchResult.matched.filter(m => m.matchType === 'email').length}`);
      console.log(`  Matched (by phone): ${matchResult.matched.filter(m => m.matchType === 'phone').length}`);
      console.log(`  Matched (by name): ${matchResult.matched.filter(m => m.matchType === 'name').length}`);
      console.log(`  Unmatched MCP: ${matchResult.mcpUnmatched.length}`);
      console.log(`  Unmatched macOS: ${matchResult.externalUnmatched.length}`);

      // PHASE 3: Sync matched contacts
      if (matchResult.matched.length > 0) {
        console.log(`\n${icons.cycle} ${colors.title('Syncing matched contacts...')}`);

        let processed = 0;
        for (const pair of matchResult.matched) {
          try {
            const syncResult = await syncMatchedPair(pair, dbOps, config, dryRun);
            if (syncResult.updated) {
              result.updated++;
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.failed++;
            result.errors.push(`${pair.mcp.name}: ${errorMsg}`);
          }

          // Progress indicator every 50 contacts
          processed++;
          if (processed % 50 === 0) {
            process.stdout.write(`\r  Synced ${processed}/${matchResult.matched.length} contacts...`);
          }
        }

        if (matchResult.matched.length >= 50) {
          console.log(''); // New line after progress
        }
        console.log(`  ${icons.success} Synced ${matchResult.matched.length} matched contacts`);
      }

      // PHASE 4: Find and merge duplicates using LLM
      if (
        syncConfig.deduplication.enableLLMDeduplication &&
        (matchResult.mcpUnmatched.length > 0 || matchResult.externalUnmatched.length > 0)
      ) {
        console.log(`\n${icons.cycle} ${colors.title('Finding duplicates...')}`);

        const potentialDuplicates = findPotentialDuplicates(
          matchResult.mcpUnmatched,
          matchResult.externalUnmatched,
          3 // max 3 candidates per contact
        );

        console.log(`  Found ${potentialDuplicates.length} potential duplicate pairs`);
        result.duplicatesFound = potentialDuplicates.length;

        if (potentialDuplicates.length > 0) {
          const dedupResult = await processDuplicates(
            potentialDuplicates,
            user.id,
            dbOps,
            config,
            dryRun,
            syncConfig.conflictResolution.autoMerge
          );

          result.merged += dedupResult.merged;
          result.failed += dedupResult.failed;
          result.skipped += dedupResult.skipped;
        }
      }

      // PHASE 5: Create new contacts
      console.log(`\n${icons.cycle} ${colors.title('Creating new contacts...')}`);

      // Import new contacts from macOS (that weren't matched or merged)
      const unmatchedExternal = macContacts.filter(ext => {
        const uuid = extractMcpUuid(ext);
        return !matchResult.matched.some(m => extractMcpUuid(m.external) === uuid);
      });

      let importProcessed = 0;
      for (const vcard of unmatchedExternal) {
        try {
          const validation = validateVCard(vcard);
          if (!validation.valid) {
            result.failed++;
            result.errors.push(`${vcard.fn}: ${validation.errors.join(', ')}`);
            continue;
          }

          const entityData = vcardToEntity(vcard, user.id, {
            entityType: EntityType.PERSON,
            importance: ImportanceLevel.MEDIUM,
            tags: ['imported-from-contacts'],
          });

          if (dryRun) {
            result.imported++;
          } else {
            const entity = createEntity(entityData);
            await dbOps.createEntity(entity);
            result.imported++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.failed++;
          result.errors.push(`${vcard.fn}: ${errorMsg}`);
        }

        // Progress indicator every 50 contacts
        importProcessed++;
        if (importProcessed % 50 === 0) {
          process.stdout.write(`\r  Imported ${importProcessed}/${unmatchedExternal.length} contacts...`);
        }
      }

      if (unmatchedExternal.length >= 50) {
        console.log(''); // New line after progress
      }
      console.log(`  ${icons.success} Imported ${result.imported} new contacts from macOS`);
    }

    // PHASE 6: Export to macOS (for unmatched MCP entities)
    if (direction === 'export' || direction === 'both') {
      console.log(`\n${icons.cycle} ${colors.title('Exporting to macOS Contacts...')}`);

      const toExport =
        direction === 'export'
          ? peopleEntities
          : peopleEntities.filter(
              e =>
                !macContacts.some(
                  m => extractMcpUuid(m) === String(e.id) || m.email?.[0] === e.email
                )
            );

      if (toExport.length > 0) {
        if (dryRun) {
          result.exported = toExport.length;
          console.log(`  ${colors.dim('[DRY RUN]')} Would export ${toExport.length} contacts`);
        } else {
          // Use batch export for better performance
          const vcards = toExport.map(entity => entityToVCard(entity));

          try {
            await batchExportToMacOS(vcards, 50);
            result.exported = toExport.length;
            console.log(`  ${icons.success} Exported ${toExport.length} contacts to macOS`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.failed += toExport.length;
            result.errors.push(`Batch export failed: ${errorMsg}`);
            console.error(`${icons.error} Batch export failed: ${errorMsg}`);
          }
        }
      }
    }

    // Print summary
    console.log(`\n${colors.title('=== Sync Summary ===')}`);
    console.log(`${colors.dim('Matched & synced:')} ${result.updated}`);
    console.log(`${colors.dim('Duplicates merged:')} ${result.merged}`);
    console.log(`${colors.dim('Imported from macOS:')} ${result.imported}`);
    console.log(`${colors.dim('Exported to macOS:')} ${result.exported}`);
    console.log(`${colors.dim('Skipped:')} ${result.skipped}`);
    console.log(`${colors.dim('Failed:')} ${result.failed}`);

    if (result.errors.length > 0) {
      console.log(`\n${colors.warning('Errors:')}`);
      for (const error of result.errors.slice(0, 10)) {
        console.log(`  ${colors.error('•')} ${error}`);
      }
      if (result.errors.length > 10) {
        console.log(`  ${colors.dim(`... and ${result.errors.length - 10} more`)}`);
      }
    }

    result.success = result.failed === 0;
  } finally {
    await db.disconnect();
  }

  return result;
}
