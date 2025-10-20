import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const result = await db.execute(`PRAGMA table_info(memories)`);
console.log('MEMORIES TABLE COLUMNS:');
result.rows.forEach((row: any) => console.log(`  ${row.name}: ${row.type}`));
db.close();
