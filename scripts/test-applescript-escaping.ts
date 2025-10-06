#!/usr/bin/env node
/**
 * Test AppleScript escaping function
 * Tests all edge cases that can break shell commands
 */

/**
 * Escape special characters for AppleScript
 * Order matters: backslashes first, then quotes, then newlines
 */
function escapeAppleScript(text: string): string {
  if (!text) return '';

  return text
    // Escape backslashes first (must be first to avoid double-escaping!)
    .replace(/\\/g, '\\\\')
    // Escape double quotes (for property values in AppleScript)
    .replace(/"/g, '\\"')
    // Escape single quotes/apostrophes (CRITICAL: breaks shell command if not escaped)
    .replace(/'/g, "\\'")
    // Escape newlines for multi-line strings
    .replace(/\n/g, '\\n')
    // Escape carriage returns
    .replace(/\r/g, '\\r');
}

// Test cases with problematic characters
const testCases = [
  {
    name: 'Apostrophe in value (original bug)',
    input: "Int'l: www.palm.com/support/globalsupport",
    expected: "Int\\'l: www.palm.com/support/globalsupport",
  },
  {
    name: 'Organization with semicolon',
    input: 'Palm, Inc.;',
    expected: 'Palm, Inc.;',
  },
  {
    name: "Name with apostrophe (O'Brien)",
    input: "O'Brien",
    expected: "O\\'Brien",
  },
  {
    name: 'Double quotes in string',
    input: 'Say "Hello"',
    expected: 'Say \\"Hello\\"',
  },
  {
    name: 'Backslash in path',
    input: 'C:\\Users\\Documents',
    expected: 'C:\\\\Users\\\\Documents',
  },
  {
    name: 'Multiple apostrophes',
    input: "It's a test of multiple 'quotes'",
    expected: "It\\'s a test of multiple \\'quotes\\'",
  },
  {
    name: 'Line break in notes',
    input: 'Line 1\nLine 2',
    expected: 'Line 1\\nLine 2',
  },
  {
    name: 'Carriage return',
    input: 'Line 1\r\nLine 2',
    expected: 'Line 1\\r\\nLine 2',
  },
  {
    name: 'Mixed special characters',
    input: "John's \"favorite\" path: C:\\Users\\John",
    expected: "John\\'s \\\"favorite\\\" path: C:\\\\Users\\\\John",
  },
  {
    name: 'Empty string',
    input: '',
    expected: '',
  },
  {
    name: 'Real-world URL with apostrophe',
    input: "Int'l: www.palm.com/support",
    expected: "Int\\'l: www.palm.com/support",
  },
];

console.log('🧪 Testing AppleScript Escaping Function\n');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = escapeAppleScript(testCase.input);
  const success = result === testCase.expected;

  if (success) {
    passed++;
    console.log(`✅ PASS: ${testCase.name}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${testCase.name}`);
    console.log(`   Input:    "${testCase.input}"`);
    console.log(`   Expected: "${testCase.expected}"`);
    console.log(`   Got:      "${result}"`);
  }
}

console.log('=' .repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  console.log('\n🔍 Testing actual AppleScript command generation:');
  console.log('\nExample with problematic data:');

  const firstName = "John";
  const lastName = "O'Brien";
  const email = "john@int'l.com";
  const org = "Palm, Inc.;";
  const notes = "Int'l: www.palm.com/support";

  console.log(`
Original values:
  First Name: ${firstName}
  Last Name:  ${lastName}
  Email:      ${email}
  Org:        ${org}
  Notes:      ${notes}

Escaped in AppleScript command:
  osascript -e 'tell application "Contacts"
    set newPerson to make new person with properties {first name:"${escapeAppleScript(firstName)}", last name:"${escapeAppleScript(lastName)}"}
    make new email at end of emails of newPerson with properties {value:"${escapeAppleScript(email)}", label:"work"}
    set organization of newPerson to "${escapeAppleScript(org)}"
    set note of newPerson to "${escapeAppleScript(notes)}"
    save
  end tell'
`);

  process.exit(0);
}
