#!/usr/bin/env node

/**
 * Test script for API endpoints
 * Tests both public and authenticated endpoints
 */

const API_BASE_URL = process.env.API_URL || 'https://mcp-memory-ts.vercel.app';
const TEST_TOKEN = process.env.TEST_TOKEN || 'test-auth-token-12345';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  message: string;
  responseTime: number;
}

async function testEndpoint(
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
    expectedStatus?: number;
    description?: string;
  } = {}
): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${API_BASE_URL}${path}`;

  try {
    console.log(`\n📍 Testing ${method} ${path}`);
    if (options.description) {
      console.log(`   ${options.description}`);
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const responseTime = Date.now() - startTime;
    const data = await response.text();

    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      // Not JSON response (might be HTML)
      jsonData = null;
    }

    const success = response.status === (options.expectedStatus || 200);

    if (success) {
      console.log(`   ✅ Success (${response.status}) - ${responseTime}ms`);
    } else {
      console.log(`   ❌ Failed - Expected ${options.expectedStatus || 200}, got ${response.status}`);
    }

    if (jsonData) {
      console.log(`   Response:`, JSON.stringify(jsonData, null, 2).slice(0, 200));
    } else if (data.includes('<!DOCTYPE html>')) {
      console.log(`   Response: HTML page (landing page)`);
    } else {
      console.log(`   Response:`, data.slice(0, 200));
    }

    return {
      endpoint: path,
      method,
      status: response.status,
      success,
      message: jsonData?.message || data.slice(0, 100),
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

    return {
      endpoint: path,
      method,
      status: 0,
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime,
    };
  }
}

async function runTests() {
  console.log('🧪 Testing MCP Memory API Endpoints');
  console.log(`📡 API URL: ${API_BASE_URL}`);
  console.log('=' .repeat(50));

  const results: TestResult[] = [];

  // Test public endpoints
  console.log('\n### PUBLIC ENDPOINTS ###');

  results.push(await testEndpoint('GET', '/', {
    description: 'Landing page (HTML)',
    expectedStatus: 200,
  }));

  results.push(await testEndpoint('GET', '/', {
    headers: { 'Accept': 'application/json' },
    description: 'Landing page (JSON)',
    expectedStatus: 200,
  }));

  results.push(await testEndpoint('GET', '/api', {
    description: 'API documentation',
    expectedStatus: 200,
  }));

  results.push(await testEndpoint('GET', '/api/health', {
    description: 'Health check',
    expectedStatus: 200,
  }));

  // Test authenticated endpoints (should fail without auth)
  console.log('\n### AUTHENTICATED ENDPOINTS (No Auth) ###');

  results.push(await testEndpoint('POST', '/api/memories', {
    body: { title: 'Test', content: 'Test content' },
    description: 'Create memory without auth',
    expectedStatus: 401,
  }));

  results.push(await testEndpoint('GET', '/api/memories/search?query=test', {
    description: 'Search memories without auth',
    expectedStatus: 401,
  }));

  // Test authenticated endpoints (with auth token)
  console.log('\n### AUTHENTICATED ENDPOINTS (With Auth) ###');

  results.push(await testEndpoint('POST', '/api/memories', {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
    body: {
      title: 'Test Memory',
      content: 'This is a test memory created via API',
      memory_type: 'MEMORY',
      importance: 'MEDIUM',
      tags: ['test', 'api'],
    },
    description: 'Create memory with auth',
    expectedStatus: 201,
  }));

  results.push(await testEndpoint('GET', '/api/memories/search?query=test', {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
    description: 'Search memories with auth',
    expectedStatus: 200,
  }));

  results.push(await testEndpoint('POST', '/api/entities', {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
    body: {
      name: 'Test Entity',
      entity_type: 'PERSON',
      description: 'A test entity',
    },
    description: 'Create entity with auth',
    expectedStatus: 201,
  }));

  results.push(await testEndpoint('GET', '/api/entities/search?query=test', {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
    description: 'Search entities with auth',
    expectedStatus: 200,
  }));

  results.push(await testEndpoint('GET', '/api/search?query=test', {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
    description: 'Unified search with auth',
    expectedStatus: 200,
  }));

  results.push(await testEndpoint('GET', '/api/statistics', {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
    description: 'Get statistics with auth',
    expectedStatus: 200,
  }));

  // Test CORS headers
  console.log('\n### CORS TESTS ###');

  results.push(await testEndpoint('OPTIONS', '/api/memories', {
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
    description: 'CORS preflight request',
    expectedStatus: 200,
  }));

  // Print summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(50));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgResponseTime = Math.round(
    results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
  );

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Avg Response Time: ${avgResponseTime}ms`);

  if (failed > 0) {
    console.log('\n🔴 Failed Tests:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - ${r.method} ${r.endpoint}: Status ${r.status}`);
      });
  }

  console.log('\n✨ Testing complete!');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});