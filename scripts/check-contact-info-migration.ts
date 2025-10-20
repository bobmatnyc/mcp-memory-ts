/**
 * Check how many entities need contact_info data migration
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkContactInfo() {
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    console.log('\n📊 Contact Info Migration Analysis\n');

    const total = await client.execute('SELECT COUNT(*) as total FROM entities');
    console.log(`Total entities: ${(total.rows[0] as any).total}`);

    const withContactInfo = await client.execute(`
      SELECT COUNT(*) as count FROM entities
      WHERE contact_info IS NOT NULL AND contact_info != ''
    `);
    console.log(`Entities with contact_info: ${(withContactInfo.rows[0] as any).count}`);

    const withEmail = await client.execute(`
      SELECT COUNT(*) as count FROM entities
      WHERE contact_info IS NOT NULL
      AND json_extract(contact_info, '$.email') IS NOT NULL
    `);
    console.log(`  - With email: ${(withEmail.rows[0] as any).count}`);

    const withPhone = await client.execute(`
      SELECT COUNT(*) as count FROM entities
      WHERE contact_info IS NOT NULL
      AND json_extract(contact_info, '$.phone') IS NOT NULL
    `);
    console.log(`  - With phone: ${(withPhone.rows[0] as any).count}`);

    const withAddress = await client.execute(`
      SELECT COUNT(*) as count FROM entities
      WHERE contact_info IS NOT NULL
      AND json_extract(contact_info, '$.address') IS NOT NULL
    `);
    console.log(`  - With address: ${(withAddress.rows[0] as any).count}`);

    console.log('\n');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

checkContactInfo();
