#!/usr/bin/env tsx

import { DatabaseConnection } from '../src/database/connection.js';

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  const db = new DatabaseConnection({
    url: process.env.TURSO_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await db.connect();
    console.log('✅ Database connection successful');
    
    const result = await db.execute('SELECT COUNT(*) as count FROM memories');
    console.log(`📊 Memory count: ${result.rows[0].count}`);
    
    await db.disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.log('❌ Database connection failed:', error);
  }
}

testDatabaseConnection();
