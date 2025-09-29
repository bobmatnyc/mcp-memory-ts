#!/usr/bin/env tsx

/**
 * Emergency schema diagnosis script
 * Checks actual database schema vs expected schema
 */

import { DatabaseConnection } from '../src/database/connection.js';

async function diagnoseSchema() {
  console.log('🔍 EMERGENCY SCHEMA DIAGNOSIS');
  console.log('=' .repeat(50));

  const db = new DatabaseConnection({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await db.connect();
    console.log('✅ Database connected');

    // Check if memories table exists and its structure
    console.log('\n📋 MEMORIES TABLE STRUCTURE:');
    try {
      const result = await db.execute("PRAGMA table_info(memories)");
      if (result.rows.length === 0) {
        console.log('❌ CRITICAL: memories table does not exist!');
      } else {
        console.log('Columns found:');
        result.rows.forEach((row: any) => {
          console.log(`  - ${row.name}: ${row.type} (nullable: ${row.notnull === 0})`);
        });
      }
    } catch (error) {
      console.log('❌ CRITICAL: Cannot access memories table:', error);
    }

    // Check for FTS table
    console.log('\n🔍 FULL-TEXT SEARCH TABLE:');
    try {
      const result = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='memories_fts'");
      if (result.rows.length === 0) {
        console.log('❌ CRITICAL: memories_fts table does not exist!');
      } else {
        console.log('✅ memories_fts table exists');
      }
    } catch (error) {
      console.log('❌ CRITICAL: Cannot check FTS table:', error);
    }

    // Check all tables
    console.log('\n📊 ALL TABLES IN DATABASE:');
    try {
      const result = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      console.log('Tables found:');
      result.rows.forEach((row: any) => {
        console.log(`  - ${row.name}`);
      });
    } catch (error) {
      console.log('❌ Cannot list tables:', error);
    }

    // Check schema version
    console.log('\n📌 SCHEMA VERSION:');
    try {
      const result = await db.execute("SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1");
      if (result.rows.length === 0) {
        console.log('❌ CRITICAL: No schema version found!');
      } else {
        console.log(`Current schema version: ${result.rows[0].version}`);
      }
    } catch (error) {
      console.log('❌ CRITICAL: Cannot check schema version:', error);
    }

    // Test a simple memory query
    console.log('\n🧪 MEMORY QUERY TEST:');
    try {
      const result = await db.execute("SELECT COUNT(*) as count FROM memories");
      console.log(`Total memories in database: ${result.rows[0].count}`);
    } catch (error) {
      console.log('❌ CRITICAL: Cannot query memories:', error);
    }

    // Check for missing columns that our code expects
    console.log('\n🔍 CHECKING FOR EXPECTED COLUMNS:');
    const expectedColumns = ['entity_ids', 'is_archived', 'importance', 'tags', 'metadata'];
    
    try {
      const result = await db.execute("PRAGMA table_info(memories)");
      const actualColumns = result.rows.map((row: any) => row.name);
      
      expectedColumns.forEach(col => {
        if (actualColumns.includes(col)) {
          console.log(`✅ ${col} - exists`);
        } else {
          console.log(`❌ ${col} - MISSING!`);
        }
      });
    } catch (error) {
      console.log('❌ Cannot check columns:', error);
    }

  } catch (error) {
    console.log('💥 FATAL ERROR:', error);
  } finally {
    await db.disconnect();
  }

  console.log('\n' + '=' .repeat(50));
  console.log('🚨 DIAGNOSIS COMPLETE');
}

// Run diagnosis
diagnoseSchema().catch(console.error);
