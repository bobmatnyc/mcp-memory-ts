#!/usr/bin/env node
/**
 * Test macOS Contacts retrieval performance
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { parseVCard } from './src/vcard/parser.js';

const execAsync = promisify(exec);

async function testMacOSContacts() {
  console.log('Testing macOS Contacts retrieval...\n');

  // Test 1: Count contacts
  console.time('Count contacts');
  const countScript = `
    tell application "Contacts"
      count every person
    end tell
  `;
  const { stdout: countResult } = await execAsync(`osascript -e '${countScript}'`);
  console.timeEnd('Count contacts');
  console.log(`Total macOS contacts: ${countResult.trim()}\n`);

  // Test 2: Get first 10 contacts only
  console.time('Get first 10 contacts');
  const sampleScript = `
    tell application "Contacts"
      set firstTen to people 1 thru 10
      set vcardData to ""
      repeat with aPerson in firstTen
        set vcardData to vcardData & vcard of aPerson
      end repeat
      return vcardData
    end tell
  `;
  const { stdout: sampleVCards } = await execAsync(`osascript -e '${sampleScript}'`);
  console.timeEnd('Get first 10 contacts');

  const parsed = parseVCard(sampleVCards);
  console.log(`Parsed ${parsed.length} vCards\n`);

  console.log('First 5 contacts:');
  parsed.slice(0, 5).forEach((vcard, i) => {
    console.log(`  ${i + 1}. ${vcard.fn} (${vcard.email?.[0] || 'no email'})`);
  });
}

testMacOSContacts().catch(console.error);
