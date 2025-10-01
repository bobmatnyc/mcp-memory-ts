#!/usr/bin/env tsx
/**
 * Test script to verify cost tracking functionality
 */

import { config } from 'dotenv';
import { initDatabaseFromEnv } from '../src/database/index.js';
import { MemoryCore } from '../src/core/index.js';
import { UsageTrackingDB } from '../src/database/usage-tracking.js';

config();

async function testCostTracking() {
  console.log('🧪 Testing Cost Tracking Implementation\n');

  try {
    // Initialize database and memory core
    console.log('1. Initializing database...');
    const db = initDatabaseFromEnv();
    const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
    await memoryCore.initialize();
    console.log('   ✅ Database initialized\n');

    // Store a test memory (will generate embedding and track cost)
    console.log('2. Storing test memory with embedding...');
    const result = await memoryCore.addMemory(
      'Test Memory for Cost Tracking',
      'This is a test memory to verify that API cost tracking is working correctly.',
      'semantic',
      {
        tags: ['test', 'cost-tracking'],
        generateEmbedding: true
      }
    );

    if (result.status === 'success') {
      console.log(`   ✅ Memory stored: ${(result.data as any)?.id}`);
    } else {
      console.error(`   ❌ Failed to store memory: ${result.error}`);
      return;
    }
    console.log('');

    // Wait a moment for the usage to be recorded
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check cost tracking
    console.log('3. Retrieving cost data...');
    const usageTracker = new UsageTrackingDB(db);
    const today = new Date().toISOString().split('T')[0];

    // Get the actual user ID from the database
    const defaultEmail = process.env.DEFAULT_USER_EMAIL || process.env.MCP_DEFAULT_USER_EMAIL;
    const userResult = await db.execute('SELECT id FROM users WHERE email = ?', [defaultEmail]);
    const userId = userResult.rows.length > 0 ? String(userResult.rows[0].id) : 'default-user';

    console.log(`   Using user ID: ${userId}\n`);

    const dailyUsage = await usageTracker.getDailyUsage(userId, today);
    console.log('   📊 Daily Usage Summary:');
    console.log(`      OpenAI Requests: ${dailyUsage.openai.requests}`);
    console.log(`      OpenAI Tokens: ${dailyUsage.openai.tokens.toLocaleString()}`);
    console.log(`      OpenAI Cost: $${dailyUsage.openai.cost.toFixed(6)}`);
    console.log(`      Total Cost: $${dailyUsage.total.cost.toFixed(6)}\n`);

    if (dailyUsage.total.requests > 0) {
      console.log('   ✅ Cost tracking is working!\n');
    } else {
      console.log('   ⚠️  No usage data found. Check logs above.\n');
    }

    // Test the get_daily_costs equivalent
    console.log('4. Generating daily cost report...');
    const report = `📊 Daily API Cost Report - ${today}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OpenAI (Embeddings):
  • Requests: ${dailyUsage.openai.requests}
  • Tokens: ${dailyUsage.openai.tokens.toLocaleString()}
  • Cost: $${dailyUsage.openai.cost.toFixed(4)}

OpenRouter:
  • Requests: ${dailyUsage.openrouter.requests}
  • Tokens: ${dailyUsage.openrouter.tokens.toLocaleString()}
  • Cost: $${dailyUsage.openrouter.cost.toFixed(4)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Daily Cost: $${dailyUsage.total.cost.toFixed(4)}
Total Requests: ${dailyUsage.total.requests}
Total Tokens: ${dailyUsage.total.tokens.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    console.log(report);
    console.log('\n✅ Cost tracking test completed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCostTracking().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
