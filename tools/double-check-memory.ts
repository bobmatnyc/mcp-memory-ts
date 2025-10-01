#!/usr/bin/env tsx

/**
 * COMPREHENSIVE DOUBLE-CHECK OF MEMORY SERVICE
 * Tests the complete memory lifecycle with actual verification
 */

import { DatabaseConnection } from '../src/database/connection.js';
import { spawn } from 'child_process';

class MemoryServiceDoubleCheck {
  private db: DatabaseConnection;

  constructor() {
    this.db = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  async sendMcpCommand(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('tsx', ['src/simple-mcp-server.ts'], {
        env: {
          ...process.env,
          TURSO_URL: process.env.TURSO_URL,
          TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
          DEFAULT_USER_EMAIL: 'doublecheck@test.com',
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      serverProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      serverProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Send request and close stdin to make server exit
      serverProcess.stdin.write(JSON.stringify(request) + '\n');
      serverProcess.stdin.end();

      // Force exit after 5 seconds
      const timeout = setTimeout(() => {
        serverProcess.kill();
        reject(new Error('Timeout'));
      }, 5000);

      serverProcess.on('exit', () => {
        clearTimeout(timeout);
        try {
          // Find the JSON response in stdout
          const lines = stdout.split('\n').filter(line => line.trim());
          const jsonLine = lines.find(line => line.startsWith('{"jsonrpc"'));
          
          if (jsonLine) {
            resolve(JSON.parse(jsonLine));
          } else {
            reject(new Error(`No JSON response found. Stdout: ${stdout}, Stderr: ${stderr}`));
          }
        } catch (error) {
          reject(new Error(`Parse error: ${error}. Stdout: ${stdout}`));
        }
      });
    });
  }

  async doubleCheckStep1_DatabaseConnection(): Promise<boolean> {
    console.log('🔍 STEP 1: Database Connection Verification');
    console.log('-'.repeat(50));

    try {
      await this.db.connect();
      console.log('✅ Database connection successful');

      // Check memory count
      const countResult = await this.db.execute('SELECT COUNT(*) as count FROM memories');
      const memoryCount = countResult.rows[0].count;
      console.log(`📊 Current memory count: ${memoryCount}`);

      // Check schema
      const schemaResult = await this.db.execute('PRAGMA table_info(memories)');
      const columns = schemaResult.rows.map((row: any) => row.name);
      console.log(`📋 Table columns: ${columns.join(', ')}`);

      // Verify critical columns exist
      const requiredColumns = ['id', 'content', 'embedding', 'entity_ids', 'is_archived'];
      const missingColumns = requiredColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log(`❌ Missing columns: ${missingColumns.join(', ')}`);
        return false;
      }

      console.log('✅ All required columns present');
      await this.db.disconnect();
      return true;

    } catch (error) {
      console.log('❌ Database connection failed:', error);
      return false;
    }
  }

  async doubleCheckStep2_MemoryStorage(): Promise<{ success: boolean; memoryId?: string }> {
    console.log('\n🔍 STEP 2: Memory Storage Test');
    console.log('-'.repeat(50));

    const testContent = `DOUBLE-CHECK TEST: ${new Date().toISOString()}`;
    
    try {
      const request = {
        jsonrpc: '2.0',
        id: 'storage-test',
        method: 'tools/call',
        params: {
          name: 'store_memory',
          arguments: {
            content: testContent,
            type: 'semantic',
            importance: 0.8,
            metadata: { test: 'double-check' }
          }
        }
      };

      console.log('📤 Sending storage request...');
      const response = await this.sendMcpCommand(request);
      
      console.log('📥 Response received:', JSON.stringify(response, null, 2));

      if (response.error) {
        console.log('❌ Storage failed with error:', response.error);
        return { success: false };
      }

      if (response.result?.content?.[0]?.text?.includes('✅ Memory stored successfully!')) {
        console.log('✅ Storage response indicates success');
        
        // Extract memory ID if present
        const text = response.result.content[0].text;
        const idMatch = text.match(/ID: (\d+)/);
        const memoryId = idMatch ? idMatch[1] : undefined;
        
        console.log(`📝 Memory ID: ${memoryId || 'not found'}`);
        return { success: true, memoryId };
      } else {
        console.log('❌ Storage response does not indicate success');
        return { success: false };
      }

    } catch (error) {
      console.log('❌ Storage test failed:', error);
      return { success: false };
    }
  }

  async doubleCheckStep3_DatabaseVerification(testContent: string): Promise<boolean> {
    console.log('\n🔍 STEP 3: Database Verification');
    console.log('-'.repeat(50));

    try {
      await this.db.connect();
      
      // Check if the memory was actually stored
      const result = await this.db.execute(
        'SELECT id, content, created_at FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT 1',
        [`%${testContent}%`]
      );

      if (result.rows.length === 0) {
        console.log('❌ Test memory not found in database');
        await this.db.disconnect();
        return false;
      }

      const memory = result.rows[0] as any;
      console.log('✅ Test memory found in database:');
      console.log(`   ID: ${memory.id}`);
      console.log(`   Content: ${memory.content.substring(0, 50)}...`);
      console.log(`   Created: ${memory.created_at}`);

      await this.db.disconnect();
      return true;

    } catch (error) {
      console.log('❌ Database verification failed:', error);
      return false;
    }
  }

  async doubleCheckStep4_MemoryRetrieval(testContent: string): Promise<boolean> {
    console.log('\n🔍 STEP 4: Memory Retrieval Test');
    console.log('-'.repeat(50));

    try {
      const request = {
        jsonrpc: '2.0',
        id: 'retrieval-test',
        method: 'tools/call',
        params: {
          name: 'recall_memories',
          arguments: {
            query: 'DOUBLE-CHECK TEST',
            limit: 5
          }
        }
      };

      console.log('📤 Sending retrieval request...');
      const response = await this.sendMcpCommand(request);
      
      console.log('📥 Response received:', JSON.stringify(response, null, 2));

      if (response.error) {
        console.log('❌ Retrieval failed with error:', response.error);
        return false;
      }

      const text = response.result?.content?.[0]?.text || '';
      
      if (text.includes('Found') && text.includes('memories')) {
        console.log('✅ Retrieval successful - memories found');
        
        // Check if our test content is in the results
        if (text.includes('DOUBLE-CHECK TEST')) {
          console.log('✅ Test memory found in search results');
          return true;
        } else {
          console.log('⚠️ Test memory not found in search results');
          console.log('Search results:', text);
          return false;
        }
      } else if (text.includes('No memories found')) {
        console.log('❌ No memories found in search');
        return false;
      } else {
        console.log('❌ Unexpected retrieval response:', text);
        return false;
      }

    } catch (error) {
      console.log('❌ Retrieval test failed:', error);
      return false;
    }
  }

  async doubleCheckStep5_Statistics(): Promise<boolean> {
    console.log('\n🔍 STEP 5: Statistics Test');
    console.log('-'.repeat(50));

    try {
      const request = {
        jsonrpc: '2.0',
        id: 'stats-test',
        method: 'tools/call',
        params: {
          name: 'get_memory_stats',
          arguments: {}
        }
      };

      console.log('📤 Sending statistics request...');
      const response = await this.sendMcpCommand(request);
      
      console.log('📥 Response received:', JSON.stringify(response, null, 2));

      if (response.error) {
        console.log('❌ Statistics failed with error:', response.error);
        return false;
      }

      const text = response.result?.content?.[0]?.text || '';
      
      if (text.includes('Total Memories:')) {
        console.log('✅ Statistics retrieved successfully');
        console.log('Stats preview:', text.split('\n')[0]);
        return true;
      } else {
        console.log('❌ Unexpected statistics response:', text);
        return false;
      }

    } catch (error) {
      console.log('❌ Statistics test failed:', error);
      return false;
    }
  }

  async runDoubleCheck(): Promise<void> {
    console.log('🚨 COMPREHENSIVE MEMORY SERVICE DOUBLE-CHECK');
    console.log('='.repeat(60));

    const testContent = `DOUBLE-CHECK TEST: ${new Date().toISOString()}`;
    
    // Step 1: Database Connection
    const dbConnected = await this.doubleCheckStep1_DatabaseConnection();
    
    // Step 2: Memory Storage
    const storageResult = await this.doubleCheckStep2_MemoryStorage();
    
    // Step 3: Database Verification
    const dbVerified = await this.doubleCheckStep3_DatabaseVerification(testContent);
    
    // Step 4: Memory Retrieval
    const retrievalWorked = await this.doubleCheckStep4_MemoryRetrieval(testContent);
    
    // Step 5: Statistics
    const statsWorked = await this.doubleCheckStep5_Statistics();

    // Final Results
    console.log('\n📊 DOUBLE-CHECK RESULTS');
    console.log('='.repeat(60));
    console.log(`Database Connection:  ${dbConnected ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Memory Storage:       ${storageResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Database Persistence: ${dbVerified ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Memory Retrieval:     ${retrievalWorked ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Statistics:           ${statsWorked ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = dbConnected && storageResult.success && dbVerified && retrievalWorked && statsWorked;
    
    console.log('\n🎯 FINAL DOUBLE-CHECK VERDICT');
    console.log('='.repeat(60));
    
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED - MEMORY SERVICE IS FULLY FUNCTIONAL');
      console.log('✅ Ready for Project Diogenes deployment');
    } else {
      console.log('🚨 SOME TESTS FAILED - MEMORY SERVICE HAS CRITICAL ISSUES');
      console.log('❌ NOT ready for deployment');
      process.exit(1);
    }
  }
}

// Run the double-check
const checker = new MemoryServiceDoubleCheck();
checker.runDoubleCheck().catch((error) => {
  console.error('💥 DOUBLE-CHECK FAILED:', error);
  process.exit(1);
});
