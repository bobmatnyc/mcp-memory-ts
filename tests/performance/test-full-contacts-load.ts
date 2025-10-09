#!/usr/bin/env node
/**
 * Test full macOS Contacts load time
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { parseVCard } from './src/vcard/parser.js';

const execAsync = promisify(exec);

async function testFullLoad() {
  console.log('Loading ALL macOS contacts...');
  console.log('This will take several minutes...\n');

  console.time('Load all contacts');

  const script = `
    tell application "Contacts"
      set allPeople to every person
      set vcardData to ""
      repeat with aPerson in allPeople
        set vcardData to vcardData & vcard of aPerson
      end repeat
      return vcardData
    end tell
  `;

  const { stdout } = await execAsync(`osascript -e '${script}'`, {
    maxBuffer: 50 * 1024 * 1024 // 50MB buffer
  });

  console.timeEnd('Load all contacts');

  console.time('Parse vCards');
  const parsed = parseVCard(stdout);
  console.timeEnd('Parse vCards');

  console.log(`\nParsed ${parsed.length} vCards`);
}

testFullLoad().catch(console.error);
