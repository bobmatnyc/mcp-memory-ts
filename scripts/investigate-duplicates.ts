#!/usr/bin/env tsx

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

async function investigateDuplicates() {
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('📋 DUPLICATE ENTITY INVESTIGATION\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const duplicates = await client.execute(`
    SELECT name, entity_type, COUNT(*) as count
    FROM entities
    WHERE entity_type IN ('person', 'organization', 'project')
    GROUP BY LOWER(name), entity_type
    HAVING count > 1
    ORDER BY count DESC, name
  `);

  console.log('Found', duplicates.rows.length, 'duplicate entity group(s):\n');

  for (const row of duplicates.rows) {
    console.log('  - Name:', row.name);
    console.log('    Type:', row.entity_type);
    console.log('    Count:', row.count);

    // Get the specific duplicates
    const instances = await client.execute(`
      SELECT id, name, contact_info, created_at
      FROM entities
      WHERE LOWER(name) = LOWER(?) AND entity_type = ?
    `, [String(row.name), String(row.entity_type)]);

    console.log('    Instances:');
    for (const inst of instances.rows) {
      const contactStr = String(inst.contact_info || '');
      const hasContactInfo = contactStr && contactStr !== '{}';
      console.log('      • ID:', inst.id, '| Contact:', hasContactInfo ? 'YES' : 'NO', '| Created:', inst.created_at);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════\n');

  client.close();
}

investigateDuplicates().catch(error => {
  console.error('Investigation failed:', error);
  process.exit(1);
});
