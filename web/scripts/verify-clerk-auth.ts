#!/usr/bin/env tsx

/**
 * Clerk Authentication Verification Script
 *
 * This script checks if Clerk authentication is properly configured
 * and provides diagnostic information for troubleshooting.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface ClerkConfig {
  publishableKey: string | undefined;
  secretKey: string | undefined;
  appUrl: string | undefined;
}

interface VerificationResult {
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

function verifyClerkConfiguration(): VerificationResult[] {
  const results: VerificationResult[] = [];

  const config: ClerkConfig = {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  };

  // Check publishable key
  if (!config.publishableKey) {
    results.push({
      status: 'fail',
      message: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing',
      details: 'This environment variable is required for Clerk authentication',
    });
  } else if (!config.publishableKey.startsWith('pk_')) {
    results.push({
      status: 'fail',
      message: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY has invalid format',
      details: `Expected format: pk_test_* or pk_live_*, got: ${config.publishableKey.substring(0, 10)}...`,
    });
  } else {
    const isTest = config.publishableKey.startsWith('pk_test_');
    results.push({
      status: 'pass',
      message: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is configured (${isTest ? 'test' : 'live'} mode)`,
    });
  }

  // Check secret key
  if (!config.secretKey) {
    results.push({
      status: 'fail',
      message: 'CLERK_SECRET_KEY is missing',
      details: 'This environment variable is required for Clerk authentication',
    });
  } else if (!config.secretKey.startsWith('sk_')) {
    results.push({
      status: 'fail',
      message: 'CLERK_SECRET_KEY has invalid format',
      details: `Expected format: sk_test_* or sk_live_*, got: ${config.secretKey.substring(0, 10)}...`,
    });
  } else {
    const isTest = config.secretKey.startsWith('sk_test_');
    results.push({
      status: 'pass',
      message: `CLERK_SECRET_KEY is configured (${isTest ? 'test' : 'live'} mode)`,
    });
  }

  // Check if both keys match environment (test vs live)
  if (config.publishableKey && config.secretKey) {
    const pubIsTest = config.publishableKey.startsWith('pk_test_');
    const secretIsTest = config.secretKey.startsWith('sk_test_');

    if (pubIsTest !== secretIsTest) {
      results.push({
        status: 'fail',
        message: 'Clerk key mismatch',
        details: `Publishable key is in ${pubIsTest ? 'test' : 'live'} mode but secret key is in ${secretIsTest ? 'test' : 'live'} mode`,
      });
    }
  }

  // Check app URL
  if (!config.appUrl) {
    results.push({
      status: 'warning',
      message: 'NEXT_PUBLIC_APP_URL is not set',
      details: 'This is optional but recommended for OAuth redirects',
    });
  } else {
    results.push({
      status: 'pass',
      message: `NEXT_PUBLIC_APP_URL is configured: ${config.appUrl}`,
    });
  }

  return results;
}

function printResults(results: VerificationResult[]): void {
  console.log('\n=== Clerk Authentication Verification ===\n');

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warnCount = results.filter(r => r.status === 'warning').length;

  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${result.message}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    console.log();
  });

  console.log('=== Summary ===');
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⚠️  Warnings: ${warnCount}`);
  console.log();

  if (failCount > 0) {
    console.log('❌ Clerk authentication is NOT properly configured');
    console.log('   Please fix the issues above before using authentication.');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('⚠️  Clerk authentication has warnings');
    console.log('   Authentication may work but some features might be limited.');
  } else {
    console.log('✅ Clerk authentication is properly configured!');
  }
}

// Run verification
const results = verifyClerkConfiguration();
printResults(results);
