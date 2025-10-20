/**
 * Comprehensive Entity Database Analysis
 *
 * Analyzes entity database quality, patterns, and issues
 * Similar to memory cleanup but focused on entities (people, organizations, projects)
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables
dotenv.config();

interface EntityRecord {
  id: number;
  user_id: string | null;
  name: string;
  entity_type: string;
  person_type: string | null;
  description: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  social_media: string | null;
  notes: string | null;
  importance: number;
  tags: string | null;
  relationships: string | null;
  last_interaction: string | null;
  interaction_count: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
}

interface MemoryRecord {
  id: number;
  entity_ids: string | null;
}

interface EntityQualityIssue {
  entity_id: number;
  issue_type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  suggested_fix?: string;
}

interface EntityAnalysisReport {
  summary: {
    total_entities: number;
    by_type: Record<string, number>;
    by_user: Record<string, number>;
    with_emails: number;
    with_phones: number;
    with_companies: number;
    orphaned: number;
    linked_to_memories: number;
  };
  quality_issues: EntityQualityIssue[];
  duplicates: {
    by_name: Array<{ name: string; count: number; entity_ids: number[] }>;
    by_email: Array<{ email: string; count: number; entity_ids: number[] }>;
  };
  memory_associations: {
    entities_with_memories: number;
    entities_without_memories: number;
    memories_with_entities: number;
    memories_without_entities: number;
  };
  patterns: {
    creation_timeline: Record<string, number>;
    entity_types_distribution: Record<string, number>;
    importance_distribution: Record<string, number>;
    user_activity: Record<string, { entities: number; types: string[] }>;
  };
  recommendations: string[];
}

async function analyzeEntities(): Promise<EntityAnalysisReport> {
  console.log('🔍 Starting comprehensive entity database analysis...\n');

  // Connect to database
  const tursoUrl = process.env.TURSO_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error('Missing TURSO_URL or TURSO_AUTH_TOKEN environment variables');
  }

  const db = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  console.log('📊 Fetching entity data...');

  // Fetch all entities
  const entitiesResult = await db.execute('SELECT * FROM entities ORDER BY created_at DESC');
  const entities = entitiesResult.rows as any[] as EntityRecord[];

  // Fetch users for reference
  const usersResult = await db.execute('SELECT id, email, name FROM users');
  const users = usersResult.rows as any[] as UserRecord[];

  // Fetch memories with entity associations
  const memoriesResult = await db.execute('SELECT id, entity_ids FROM memories WHERE entity_ids IS NOT NULL');
  const memories = memoriesResult.rows as any[] as MemoryRecord[];

  console.log(`✅ Loaded ${entities.length} entities, ${users.length} users, ${memories.length} memories with entities\n`);

  // Initialize report
  const report: EntityAnalysisReport = {
    summary: {
      total_entities: entities.length,
      by_type: {},
      by_user: {},
      with_emails: 0,
      with_phones: 0,
      with_companies: 0,
      orphaned: 0,
      linked_to_memories: 0,
    },
    quality_issues: [],
    duplicates: {
      by_name: [],
      by_email: [],
    },
    memory_associations: {
      entities_with_memories: 0,
      entities_without_memories: 0,
      memories_with_entities: memories.length,
      memories_without_entities: 0,
    },
    patterns: {
      creation_timeline: {},
      entity_types_distribution: {},
      importance_distribution: {},
      user_activity: {},
    },
    recommendations: [],
  };

  // Build entity ID set for memory association lookup
  const entityIdsInMemories = new Set<number>();
  memories.forEach(memory => {
    if (memory.entity_ids) {
      try {
        const ids = JSON.parse(memory.entity_ids);
        if (Array.isArray(ids)) {
          ids.forEach(id => entityIdsInMemories.add(Number(id)));
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }
  });

  // Build user email map
  const userEmailMap = new Map<string, string>();
  users.forEach(user => {
    userEmailMap.set(user.id, user.email);
  });

  console.log('🔎 Analyzing entity quality...\n');

  // Track for duplicate detection
  const nameMap = new Map<string, number[]>();
  const emailMap = new Map<string, number[]>();

  // Analyze each entity
  entities.forEach(entity => {
    // Count by type
    report.summary.by_type[entity.entity_type] = (report.summary.by_type[entity.entity_type] || 0) + 1;

    // Count by user
    const userEmail = entity.user_id ? userEmailMap.get(entity.user_id) || entity.user_id : 'unknown';
    report.summary.by_user[userEmail] = (report.summary.by_user[userEmail] || 0) + 1;

    // Count fields
    if (entity.email) report.summary.with_emails++;
    if (entity.phone) report.summary.with_phones++;
    if (entity.company) report.summary.with_companies++;

    // Check if linked to memories
    if (entityIdsInMemories.has(entity.id)) {
      report.summary.linked_to_memories++;
    } else {
      report.summary.orphaned++;
    }

    // Pattern: creation timeline
    const creationDate = entity.created_at.split('T')[0];
    report.patterns.creation_timeline[creationDate] = (report.patterns.creation_timeline[creationDate] || 0) + 1;

    // Pattern: importance distribution
    const impKey = `level_${entity.importance}`;
    report.patterns.importance_distribution[impKey] = (report.patterns.importance_distribution[impKey] || 0) + 1;

    // Pattern: user activity
    if (!report.patterns.user_activity[userEmail]) {
      report.patterns.user_activity[userEmail] = { entities: 0, types: [] };
    }
    report.patterns.user_activity[userEmail].entities++;
    if (!report.patterns.user_activity[userEmail].types.includes(entity.entity_type)) {
      report.patterns.user_activity[userEmail].types.push(entity.entity_type);
    }

    // Track for duplicate detection
    const normalizedName = entity.name.toLowerCase().trim();
    if (!nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, []);
    }
    nameMap.get(normalizedName)!.push(entity.id);

    if (entity.email) {
      const normalizedEmail = entity.email.toLowerCase().trim();
      if (!emailMap.has(normalizedEmail)) {
        emailMap.set(normalizedEmail, []);
      }
      emailMap.get(normalizedEmail)!.push(entity.id);
    }

    // Quality checks
    // 1. NULL or empty name (critical)
    if (!entity.name || entity.name.trim() === '') {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'empty_name',
        severity: 'critical',
        description: 'Entity has empty or null name',
        suggested_fix: 'Delete entity or populate name from other fields',
      });
    }

    // 2. NULL user_id (critical for multi-tenant)
    if (!entity.user_id) {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'null_user_id',
        severity: 'critical',
        description: 'Entity has null user_id (security concern)',
        suggested_fix: 'Assign to a user or delete',
      });
    }

    // 3. Person without email or phone (warning)
    if (entity.entity_type === 'person' && !entity.email && !entity.phone) {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'person_no_contact',
        severity: 'warning',
        description: 'Person entity has no email or phone',
        suggested_fix: 'Add contact information or convert to organization',
      });
    }

    // 4. Organization without company field (warning)
    if (entity.entity_type === 'organization' && !entity.company) {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'org_no_company',
        severity: 'warning',
        description: 'Organization entity missing company field',
        suggested_fix: 'Populate company field from name or description',
      });
    }

    // 5. Empty description and notes (info)
    if (!entity.description && !entity.notes) {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'no_description',
        severity: 'info',
        description: 'Entity has no description or notes',
        suggested_fix: 'Add description for better context',
      });
    }

    // 6. Invalid email format (warning)
    if (entity.email && !entity.email.includes('@')) {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'invalid_email',
        severity: 'warning',
        description: `Invalid email format: ${entity.email}`,
        suggested_fix: 'Correct email format or remove',
      });
    }

    // 7. Very old last_interaction (info)
    if (entity.last_interaction) {
      const lastInteraction = new Date(entity.last_interaction);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      if (lastInteraction < sixMonthsAgo) {
        report.quality_issues.push({
          entity_id: entity.id,
          issue_type: 'stale_interaction',
          severity: 'info',
          description: `Last interaction over 6 months ago: ${entity.last_interaction}`,
          suggested_fix: 'Archive or update interaction date',
        });
      }
    }
  });

  // Find duplicates
  console.log('🔍 Detecting duplicates...\n');

  nameMap.forEach((ids, name) => {
    if (ids.length > 1) {
      report.duplicates.by_name.push({
        name,
        count: ids.length,
        entity_ids: ids,
      });
    }
  });

  emailMap.forEach((ids, email) => {
    if (ids.length > 1) {
      report.duplicates.by_email.push({
        email,
        count: ids.length,
        entity_ids: ids,
      });
    }
  });

  // Memory associations
  report.memory_associations.entities_with_memories = report.summary.linked_to_memories;
  report.memory_associations.entities_without_memories = report.summary.orphaned;

  // Count memories without entities
  const totalMemoriesResult = await db.execute('SELECT COUNT(*) as count FROM memories');
  const totalMemories = (totalMemoriesResult.rows[0] as any).count;
  report.memory_associations.memories_without_entities = totalMemories - memories.length;

  // Generate recommendations
  console.log('💡 Generating recommendations...\n');

  if (report.quality_issues.filter(i => i.severity === 'critical').length > 0) {
    report.recommendations.push('🔴 CRITICAL: Fix entities with null user_id or empty names immediately');
  }

  if (report.duplicates.by_name.length > 0) {
    report.recommendations.push(`⚠️  ${report.duplicates.by_name.length} duplicate names found - consider merging entities`);
  }

  if (report.duplicates.by_email.length > 0) {
    report.recommendations.push(`⚠️  ${report.duplicates.by_email.length} duplicate emails found - merge or update entities`);
  }

  if (report.summary.orphaned > report.summary.linked_to_memories) {
    const orphanPercent = ((report.summary.orphaned / report.summary.total_entities) * 100).toFixed(1);
    report.recommendations.push(`📊 ${orphanPercent}% of entities are not linked to any memories - consider linking or archiving`);
  }

  if (report.memory_associations.memories_without_entities > report.memory_associations.memories_with_entities) {
    const memoryPercent = ((report.memory_associations.memories_without_entities / totalMemories) * 100).toFixed(1);
    report.recommendations.push(`📝 ${memoryPercent}% of memories have no entity associations - improve linking`);
  }

  if (report.quality_issues.filter(i => i.issue_type === 'person_no_contact').length > 10) {
    report.recommendations.push('📞 Many person entities lack contact information - add emails or phones');
  }

  if (entities.length === 0) {
    report.recommendations.push('⚠️  No entities found - MCP stats showing 0 is accurate');
  }

  return report;
}

function printReport(report: EntityAnalysisReport) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                 ENTITY DATABASE ANALYSIS REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Summary
  console.log('📊 ENTITY SUMMARY');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Total Entities: ${report.summary.total_entities}`);
  console.log('\nBy Type:');
  Object.entries(report.summary.by_type)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  console.log('\nBy User:');
  Object.entries(report.summary.by_user)
    .sort((a, b) => b[1] - a[1])
    .forEach(([user, count]) => {
      console.log(`  ${user}: ${count}`);
    });
  console.log(`\nWith Emails: ${report.summary.with_emails}`);
  console.log(`With Phones: ${report.summary.with_phones}`);
  console.log(`With Companies: ${report.summary.with_companies}`);
  console.log(`Linked to Memories: ${report.summary.linked_to_memories}`);
  console.log(`Orphaned (No Memory Links): ${report.summary.orphaned}`);

  // Memory Associations
  console.log('\n📝 ENTITY-MEMORY ASSOCIATIONS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Entities WITH memories: ${report.memory_associations.entities_with_memories}`);
  console.log(`Entities WITHOUT memories: ${report.memory_associations.entities_without_memories}`);
  console.log(`Memories WITH entities: ${report.memory_associations.memories_with_entities}`);
  console.log(`Memories WITHOUT entities: ${report.memory_associations.memories_without_entities}`);

  // Quality Issues
  console.log('\n⚠️  QUALITY ISSUES');
  console.log('─────────────────────────────────────────────────────────────');
  const criticalIssues = report.quality_issues.filter(i => i.severity === 'critical');
  const warningIssues = report.quality_issues.filter(i => i.severity === 'warning');
  const infoIssues = report.quality_issues.filter(i => i.severity === 'info');

  console.log(`Critical Issues: ${criticalIssues.length}`);
  console.log(`Warnings: ${warningIssues.length}`);
  console.log(`Info: ${infoIssues.length}`);

  if (criticalIssues.length > 0) {
    console.log('\n🔴 Critical Issues (Top 10):');
    criticalIssues.slice(0, 10).forEach(issue => {
      console.log(`  Entity ${issue.entity_id}: ${issue.description}`);
      if (issue.suggested_fix) {
        console.log(`    → Fix: ${issue.suggested_fix}`);
      }
    });
  }

  if (warningIssues.length > 0) {
    console.log('\n⚠️  Warnings (Top 10):');
    warningIssues.slice(0, 10).forEach(issue => {
      console.log(`  Entity ${issue.entity_id}: ${issue.description}`);
    });
  }

  // Duplicates
  console.log('\n🔄 DUPLICATE DETECTION');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Duplicate Names: ${report.duplicates.by_name.length}`);
  console.log(`Duplicate Emails: ${report.duplicates.by_email.length}`);

  if (report.duplicates.by_name.length > 0) {
    console.log('\nDuplicate Names (Top 10):');
    report.duplicates.by_name.slice(0, 10).forEach(dup => {
      console.log(`  "${dup.name}": ${dup.count} entities [IDs: ${dup.entity_ids.join(', ')}]`);
    });
  }

  if (report.duplicates.by_email.length > 0) {
    console.log('\nDuplicate Emails (Top 10):');
    report.duplicates.by_email.slice(0, 10).forEach(dup => {
      console.log(`  "${dup.email}": ${dup.count} entities [IDs: ${dup.entity_ids.join(', ')}]`);
    });
  }

  // Patterns
  console.log('\n📈 DATA PATTERNS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Creation Timeline (Last 10 Days):');
  Object.entries(report.patterns.creation_timeline)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10)
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} entities`);
    });

  console.log('\nImportance Distribution:');
  Object.entries(report.patterns.importance_distribution)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([level, count]) => {
      console.log(`  ${level}: ${count}`);
    });

  console.log('\nUser Activity:');
  Object.entries(report.patterns.user_activity)
    .sort((a, b) => b[1].entities - a[1].entities)
    .forEach(([user, activity]) => {
      console.log(`  ${user}: ${activity.entities} entities (types: ${activity.types.join(', ')})`);
    });

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('─────────────────────────────────────────────────────────────');
  if (report.recommendations.length === 0) {
    console.log('✅ No major issues found - entity database looks healthy!');
  } else {
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// Main execution
async function main() {
  try {
    const report = await analyzeEntities();
    printReport(report);

    // Export to JSON
    const outputPath = resolve(process.cwd(), 'entity-analysis-report.json');
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report exported to: ${outputPath}\n`);

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main();
