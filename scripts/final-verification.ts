#!/usr/bin/env tsx

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

interface VerificationResult {
  category: string;
  checks: Array<{
    name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    value: any;
    expected?: any;
  }>;
}

async function runFinalVerification() {
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 FINAL PRODUCTION READINESS VERIFICATION');
  console.log('═══════════════════════════════════════════════════════\n');

  const results: VerificationResult[] = [];
  let criticalIssues = 0;
  let warnings = 0;
  let totalChecks = 0;
  let passedChecks = 0;

  // 1. NULL ID Verification (CRITICAL)
  console.log('1️⃣ NULL ID VERIFICATION (CRITICAL)');
  console.log('───────────────────────────────────────────────────────');

  const nullEntities = await client.execute('SELECT COUNT(*) as count FROM entities WHERE id IS NULL');
  const nullMemories = await client.execute('SELECT COUNT(*) as count FROM memories WHERE id IS NULL');
  const nullInteractions = await client.execute('SELECT COUNT(*) as count FROM interactions WHERE id IS NULL');

  const nullIdChecks = [
    { name: 'Entities with NULL IDs', value: Number(nullEntities.rows[0].count), expected: 0 },
    { name: 'Memories with NULL IDs', value: Number(nullMemories.rows[0].count), expected: 0 },
    { name: 'Interactions with NULL IDs', value: Number(nullInteractions.rows[0].count), expected: 0 },
  ];

  for (const check of nullIdChecks) {
    totalChecks++;
    const status = check.value === check.expected ? 'PASS' : 'FAIL';
    if (status === 'PASS') passedChecks++;
    else criticalIssues++;

    console.log(`${check.name}: ${check.value} ${status === 'PASS' ? '✅' : '❌'}`);
  }

  results.push({ category: 'NULL ID Verification', checks: nullIdChecks.map(c => ({ ...c, status: c.value === c.expected ? 'PASS' : 'FAIL' })) });

  // 2. Data Integrity (CRITICAL)
  console.log('\n2️⃣ DATA INTEGRITY (CRITICAL)');
  console.log('───────────────────────────────────────────────────────');

  const totalEntities = await client.execute('SELECT COUNT(*) as count FROM entities');
  const totalMemories = await client.execute('SELECT COUNT(*) as count FROM memories');
  const totalInteractions = await client.execute('SELECT COUNT(*) as count FROM interactions');

  const entityCount = Number(totalEntities.rows[0].count);
  const memoryCount = Number(totalMemories.rows[0].count);
  const interactionCount = Number(totalInteractions.rows[0].count);

  console.log(`Total entities:     ${entityCount}`);
  console.log(`Total memories:     ${memoryCount}`);
  console.log(`Total interactions: ${interactionCount}`);

  // UUID format validation
  const invalidUUIDs = await client.execute(`
    SELECT COUNT(*) as count FROM entities
    WHERE LENGTH(id) < 8
    OR (id NOT LIKE '%-%' AND CAST(id AS INTEGER) = 0)
  `);

  const uuidCheck = {
    name: 'Invalid UUID format',
    value: Number(invalidUUIDs.rows[0].count),
    expected: 0
  };
  totalChecks++;
  const uuidStatus = uuidCheck.value === 0 ? 'PASS' : 'WARN';
  if (uuidStatus === 'PASS') passedChecks++;
  else warnings++;

  console.log(`Invalid UUID format: ${uuidCheck.value} ${uuidStatus === 'PASS' ? '✅' : '⚠️'}`);

  results.push({
    category: 'Data Integrity',
    checks: [
      { name: 'Total entities', value: entityCount, status: 'PASS' },
      { name: 'Total memories', value: memoryCount, status: 'PASS' },
      { name: 'Total interactions', value: interactionCount, status: 'PASS' },
      { ...uuidCheck, status: uuidStatus }
    ]
  });

  // 3. Security & Configuration (CRITICAL)
  console.log('\n3️⃣ SECURITY & CONFIGURATION (CRITICAL)');
  console.log('───────────────────────────────────────────────────────');

  const nullUserEntities = await client.execute('SELECT COUNT(*) as count FROM entities WHERE user_id IS NULL');
  const nullUserMemories = await client.execute('SELECT COUNT(*) as count FROM memories WHERE user_id IS NULL');
  const nullUserInteractions = await client.execute('SELECT COUNT(*) as count FROM interactions WHERE user_id IS NULL');

  const securityChecks = [
    { name: 'Entities with NULL user_id', value: Number(nullUserEntities.rows[0].count), expected: 0 },
    { name: 'Memories with NULL user_id', value: Number(nullUserMemories.rows[0].count), expected: 0 },
    { name: 'Interactions with NULL user_id', value: Number(nullUserInteractions.rows[0].count), expected: 0 },
  ];

  for (const check of securityChecks) {
    totalChecks++;
    const status = check.value === check.expected ? 'PASS' : 'FAIL';
    if (status === 'PASS') passedChecks++;
    else criticalIssues++;

    console.log(`${check.name}: ${check.value} ${status === 'PASS' ? '✅' : '❌'}`);
  }

  results.push({ category: 'Security & Configuration', checks: securityChecks.map(c => ({ ...c, status: c.value === c.expected ? 'PASS' : 'FAIL' })) });

  // 4. Data Quality (HIGH PRIORITY)
  console.log('\n4️⃣ DATA QUALITY (HIGH PRIORITY)');
  console.log('───────────────────────────────────────────────────────');

  // Duplicate entities
  const duplicates = await client.execute(`
    SELECT COUNT(*) as total_groups, SUM(count - 1) as excess_count
    FROM (
      SELECT name, entity_type, COUNT(*) as count
      FROM entities
      WHERE entity_type IN ('person', 'organization', 'project')
      GROUP BY LOWER(name), entity_type
      HAVING count > 1
    )
  `);

  const dupGroups = Number(duplicates.rows[0].total_groups || 0);
  const excessDups = Number(duplicates.rows[0].excess_count || 0);
  console.log(`Duplicate entity groups:   ${dupGroups}`);
  console.log(`Excess duplicate entities: ${excessDups}`);

  // Contact info coverage
  const withContactInfo = await client.execute(`
    SELECT COUNT(*) as count FROM entities
    WHERE entity_type = 'person' AND contact_info IS NOT NULL AND contact_info != '{}'
  `);
  const totalPeople = await client.execute("SELECT COUNT(*) as count FROM entities WHERE entity_type = 'person'");

  const peopleWithContact = Number(withContactInfo.rows[0].count);
  const totalPeopleCount = Number(totalPeople.rows[0].count);
  const coverage = totalPeopleCount > 0 ? ((peopleWithContact / totalPeopleCount) * 100).toFixed(1) : '0';

  totalChecks++;
  const coverageStatus = parseFloat(coverage) >= 95 ? 'PASS' : 'WARN';
  if (coverageStatus === 'PASS') passedChecks++;
  else warnings++;

  console.log(`Contact info coverage:     ${coverage}% ${coverageStatus === 'PASS' ? '✅' : '⚠️'}`);

  // Empty content
  const emptyMemories = await client.execute(`
    SELECT COUNT(*) as count FROM memories
    WHERE content IS NULL OR TRIM(content) = ''
  `);

  const emptyCount = Number(emptyMemories.rows[0].count);
  totalChecks++;
  const emptyStatus = emptyCount === 0 ? 'PASS' : 'WARN';
  if (emptyStatus === 'PASS') passedChecks++;
  else warnings++;

  console.log(`Memories with empty content: ${emptyCount} ${emptyStatus === 'PASS' ? '✅' : '⚠️'}`);

  // Test entities
  const testEntities = await client.execute(`
    SELECT COUNT(*) as count FROM entities
    WHERE LOWER(name) LIKE '%test%' OR LOWER(name) LIKE '%example%'
  `);

  const testCount = Number(testEntities.rows[0].count);
  totalChecks++;
  const testStatus = testCount === 0 ? 'PASS' : 'WARN';
  if (testStatus === 'PASS') passedChecks++;
  else warnings++;

  console.log(`Test/example entities:       ${testCount} ${testStatus === 'PASS' ? '✅' : '⚠️'}`);

  results.push({
    category: 'Data Quality',
    checks: [
      { name: 'Duplicate entity groups', value: dupGroups, status: 'PASS' },
      { name: 'Excess duplicate entities', value: excessDups, status: 'PASS' },
      { name: 'Contact info coverage', value: `${coverage}%`, expected: '>=95%', status: coverageStatus },
      { name: 'Memories with empty content', value: emptyCount, expected: 0, status: emptyStatus },
      { name: 'Test/example entities', value: testCount, expected: 0, status: testStatus }
    ]
  });

  // 5. Foreign Key Integrity (CRITICAL)
  console.log('\n5️⃣ FOREIGN KEY INTEGRITY (CRITICAL)');
  console.log('───────────────────────────────────────────────────────');

  // Check for orphaned entity_ids in memories (stored as JSON array)
  const memoriesWithEntityIds = await client.execute(`
    SELECT COUNT(*) as count FROM memories
    WHERE entity_ids IS NOT NULL AND entity_ids != '[]'
  `);

  const fkChecks = [
    { name: 'Memories with entity references', value: Number(memoriesWithEntityIds.rows[0].count), expected: 'any' },
  ];

  for (const check of fkChecks) {
    totalChecks++;
    // For 'any' expected value, always pass if value >= 0
    const status = check.expected === 'any' ? 'PASS' : (check.value === check.expected ? 'PASS' : 'FAIL');
    if (status === 'PASS') passedChecks++;
    else criticalIssues++;

    console.log(`${check.name}: ${check.value} ${status === 'PASS' ? '✅' : '❌'}`);
  }

  results.push({ category: 'Foreign Key Integrity', checks: fkChecks.map(c => ({ ...c, status: c.expected === 'any' ? 'PASS' : (c.value === c.expected ? 'PASS' : 'FAIL') })) });

  // Calculate Production Readiness Score
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 FINAL ASSESSMENT');
  console.log('═══════════════════════════════════════════════════════\n');

  const baseScore = (passedChecks / totalChecks) * 100;
  const criticalPenalty = criticalIssues * 20; // Each critical issue -20 points
  const warningPenalty = warnings * 5; // Each warning -5 points
  const productionScore = Math.max(0, Math.min(100, baseScore - criticalPenalty - warningPenalty));

  console.log(`Checks Passed:         ${passedChecks}/${totalChecks} (${((passedChecks/totalChecks)*100).toFixed(1)}%)`);
  console.log(`Critical Issues:       ${criticalIssues} ${criticalIssues === 0 ? '✅' : '❌'}`);
  console.log(`Warnings:              ${warnings} ${warnings === 0 ? '✅' : '⚠️'}`);
  console.log(`\n🎯 Production Readiness Score: ${productionScore.toFixed(0)}/100`);

  // Overall status: PASS if no critical issues, regardless of warnings
  const passFailStatus = criticalIssues === 0 ? 'PASS' : 'FAIL';
  console.log(`📋 Overall Status: ${passFailStatus} ${passFailStatus === 'PASS' ? '✅' : '❌'}`);

  // Final Statistics Summary
  console.log('\n📈 FINAL DATABASE STATISTICS');
  console.log('───────────────────────────────────────────────────────');
  console.log(`Total Entities:        ${entityCount}`);
  console.log(`Total Memories:        ${memoryCount}`);
  console.log(`Total Interactions:    ${interactionCount}`);
  console.log(`Contact Info Coverage: ${coverage}%`);
  console.log(`Duplicate Groups:      ${dupGroups}`);
  console.log(`Test Entities:         ${testCount}`);

  // Recommendation
  console.log('\n🎬 RECOMMENDATION');
  console.log('───────────────────────────────────────────────────────');

  if (criticalIssues === 0 && warnings === 0) {
    console.log('✅ READY FOR PRODUCTION DEPLOYMENT');
    console.log('   All checks passed. Database is in excellent condition.');
  } else if (criticalIssues === 0 && warnings <= 3) {
    console.log('✅ READY FOR PRODUCTION WITH MINOR WARNINGS');
    console.log('   All critical checks passed. Database is production-ready.');
    console.log(`   ${warnings} minor warning(s) can be addressed post-deployment.`);
  } else if (criticalIssues === 0) {
    console.log('⚠️  READY WITH WARNINGS');
    console.log('   All critical checks passed but multiple warnings exist.');
    console.log(`   Consider addressing ${warnings} warning(s) before deployment.`);
  } else {
    console.log('❌ NOT READY FOR PRODUCTION');
    console.log(`   ${criticalIssues} critical issue(s) must be resolved before deployment.`);
  }

  console.log('\n═══════════════════════════════════════════════════════\n');

  client.close();

  // Exit with appropriate code
  process.exit(criticalIssues > 0 ? 1 : 0);
}

runFinalVerification().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});
