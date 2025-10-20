/**
 * Comprehensive Entity Database Analysis v2
 * Updated for actual schema (contact_info JSON field, not separate columns)
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

interface EntityRecord {
  id: string;
  user_id: string | null;
  name: string;
  entity_type: string;
  person_type: string | null;
  description: string | null;
  company: string | null;
  title: string | null;
  contact_info: string | null;  // JSON string
  notes: string | null;
  tags: string | null;  // JSON string
  metadata: string | null;  // JSON string
  macos_contact_id: string | null;
  created_at: string;
  updated_at: string;
  active: number;
}

interface ContactInfo {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  linkedin?: string | null;
  github?: string | null;
  website?: string | null;
}

interface EntityQualityIssue {
  entity_id: string;
  issue_type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  suggested_fix?: string;
}

async function analyzeEntities() {
  console.log('🔍 Starting comprehensive entity database analysis (v2)...\n');

  const tursoUrl = process.env.TURSO_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error('Missing TURSO_URL or TURSO_AUTH_TOKEN');
  }

  const db = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  console.log('📊 Fetching entity data...');

  // Fetch all entities
  const entitiesResult = await db.execute('SELECT * FROM entities ORDER BY created_at DESC');
  const entities = entitiesResult.rows as any[] as EntityRecord[];

  console.log(`✅ Loaded ${entities.length} entities\n`);

  // Initialize report
  const report = {
    summary: {
      total_entities: entities.length,
      by_type: {} as Record<string, number>,
      by_user: {} as Record<string, number>,
      with_emails: 0,
      with_phones: 0,
      with_companies: 0,
      with_contact_info: 0,
      null_user_id: 0,
      inactive: 0,
    },
    quality_issues: [] as EntityQualityIssue[],
    duplicates: {
      by_name: [] as Array<{ name: string; count: number; entity_ids: string[] }>,
    },
  };

  // Track for duplicate detection
  const nameMap = new Map<string, string[]>();

  console.log('🔎 Analyzing entity quality...\n');

  // Analyze each entity
  entities.forEach(entity => {
    // Count by type
    report.summary.by_type[entity.entity_type] = (report.summary.by_type[entity.entity_type] || 0) + 1;

    // Count by user
    const userKey = entity.user_id || 'NULL';
    report.summary.by_user[userKey] = (report.summary.by_user[userKey] || 0) + 1;

    // Count NULL user_id
    if (!entity.user_id) {
      report.summary.null_user_id++;
    }

    // Count inactive
    if (entity.active === 0) {
      report.summary.inactive++;
    }

    // Parse contact_info
    let contactInfo: ContactInfo | null = null;
    if (entity.contact_info) {
      try {
        contactInfo = JSON.parse(entity.contact_info);
        report.summary.with_contact_info++;
        if (contactInfo?.email) report.summary.with_emails++;
        if (contactInfo?.phone) report.summary.with_phones++;
      } catch (e) {
        // Invalid JSON
      }
    }

    // Count companies
    if (entity.company) report.summary.with_companies++;

    // Track for duplicate detection
    const normalizedName = entity.name.toLowerCase().trim();
    if (!nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, []);
    }
    nameMap.get(normalizedName)!.push(entity.id);

    // Quality checks
    // 1. NULL user_id (CRITICAL for multi-tenant security)
    if (!entity.user_id) {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'null_user_id',
        severity: 'critical',
        description: 'Entity has null user_id (security concern)',
        suggested_fix: 'Assign to a user or delete',
      });
    }

    // 2. Empty or NULL name (CRITICAL)
    if (!entity.name || entity.name.trim() === '') {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'empty_name',
        severity: 'critical',
        description: 'Entity has empty or null name',
        suggested_fix: 'Delete entity or populate name',
      });
    }

    // 3. Person without contact info (WARNING)
    if (entity.entity_type === 'person' && !contactInfo) {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'person_no_contact',
        severity: 'warning',
        description: 'Person entity has no contact info',
        suggested_fix: 'Add contact_info JSON with email/phone',
      });
    }

    // 4. Person with contact_info but no email or phone (WARNING)
    if (entity.entity_type === 'person' && contactInfo && !contactInfo.email && !contactInfo.phone) {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'person_no_email_phone',
        severity: 'warning',
        description: 'Person has contact_info but no email or phone',
        suggested_fix: 'Add email or phone to contact_info',
      });
    }

    // 5. No description (INFO)
    if (!entity.description && !entity.notes) {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'no_description',
        severity: 'info',
        description: 'Entity has no description or notes',
        suggested_fix: 'Add description for context',
      });
    }

    // 6. Invalid email format (WARNING)
    if (contactInfo?.email && !contactInfo.email.includes('@')) {
      report.quality_issues.push({
        entity_id: entity.id,
        issue_type: 'invalid_email',
        severity: 'warning',
        description: `Invalid email format: ${contactInfo.email}`,
        suggested_fix: 'Correct email format or remove',
      });
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

  // Print report
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('              ENTITY DATABASE ANALYSIS REPORT (V2)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('📊 ENTITY SUMMARY');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Total Entities: ${report.summary.total_entities}`);
  console.log(`  NULL user_id: ${report.summary.null_user_id}`);
  console.log(`  Inactive: ${report.summary.inactive}`);
  console.log(`  With contact_info: ${report.summary.with_contact_info}`);
  console.log(`  With emails: ${report.summary.with_emails}`);
  console.log(`  With phones: ${report.summary.with_phones}`);
  console.log(`  With companies: ${report.summary.with_companies}`);

  console.log('\nBy Type:');
  Object.entries(report.summary.by_type)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  console.log('\nBy User (Top 10):');
  Object.entries(report.summary.by_user)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([user, count]) => {
      console.log(`  ${user}: ${count}`);
    });

  console.log('\n⚠️  QUALITY ISSUES');
  console.log('─────────────────────────────────────────────────────────────');
  const criticalIssues = report.quality_issues.filter(i => i.severity === 'critical');
  const warningIssues = report.quality_issues.filter(i => i.severity === 'warning');
  const infoIssues = report.quality_issues.filter(i => i.severity === 'info');

  console.log(`Critical Issues: ${criticalIssues.length}`);
  console.log(`Warnings: ${warningIssues.length}`);
  console.log(`Info: ${infoIssues.length}`);

  if (criticalIssues.length > 0) {
    console.log('\n🔴 Critical Issues (Top 20):');
    const issueTypes = new Map<string, number>();
    criticalIssues.forEach(issue => {
      issueTypes.set(issue.issue_type, (issueTypes.get(issue.issue_type) || 0) + 1);
    });

    issueTypes.forEach((count, type) => {
      console.log(`  ${type}: ${count} entities`);
    });

    console.log('\n  Sample critical issues:');
    criticalIssues.slice(0, 5).forEach(issue => {
      console.log(`    Entity ${issue.entity_id}: ${issue.description}`);
      if (issue.suggested_fix) {
        console.log(`      → Fix: ${issue.suggested_fix}`);
      }
    });
  }

  if (warningIssues.length > 0) {
    console.log('\n⚠️  Warning Issues Summary:');
    const issueTypes = new Map<string, number>();
    warningIssues.forEach(issue => {
      issueTypes.set(issue.issue_type, (issueTypes.get(issue.issue_type) || 0) + 1);
    });

    issueTypes.forEach((count, type) => {
      console.log(`  ${type}: ${count} entities`);
    });
  }

  console.log('\n🔄 DUPLICATE DETECTION');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Duplicate Names: ${report.duplicates.by_name.length}`);

  if (report.duplicates.by_name.length > 0) {
    console.log('\nTop 10 duplicate names:');
    report.duplicates.by_name
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .forEach(dup => {
        console.log(`  "${dup.name}": ${dup.count} entities`);
      });
  }

  console.log('\n💡 RECOMMENDATIONS');
  console.log('─────────────────────────────────────────────────────────────');

  const recommendations: string[] = [];

  if (report.summary.null_user_id > 0) {
    recommendations.push(`🔴 CRITICAL: ${report.summary.null_user_id} entities have NULL user_id - security issue`);
  }

  if (report.duplicates.by_name.length > 0) {
    recommendations.push(`⚠️  ${report.duplicates.by_name.length} duplicate names found - consider merging`);
  }

  const noContactPercent = ((warningIssues.filter(i => i.issue_type.includes('contact')).length / report.summary.total_entities) * 100).toFixed(1);
  if (parseFloat(noContactPercent) > 10) {
    recommendations.push(`📞 ${noContactPercent}% of entities lack contact information`);
  }

  if (recommendations.length === 0) {
    console.log('✅ No major issues found - entity database looks healthy!');
  } else {
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  // Export to JSON
  const fs = await import('fs/promises');
  const outputPath = '/Users/masa/Projects/mcp-memory-ts/entity-analysis-report-v2.json';
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(`📄 Full report exported to: ${outputPath}\n`);
}

analyzeEntities().catch(console.error);
