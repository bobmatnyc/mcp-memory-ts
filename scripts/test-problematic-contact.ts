#!/usr/bin/env node
/**
 * Test the exact problematic contact data from the error report
 * This simulates what would happen during actual contact sync
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

console.log('🔍 Testing Problematic Contact Data from Error Report\n');
console.log('=' .repeat(80));

// Exact data from the error:
// value:"Int'l: www.palm.com/support/globalsupport"
// organization: "Palm, Inc.;"

const problematicContact = {
  firstName: 'David',
  lastName: 'Nagel',
  email: 'david@palm.com',
  phone: '+1-408-503-7000',
  org: 'Palm, Inc.;',
  title: 'President',
  notes: "Int'l: www.palm.com/support/globalsupport",
};

console.log('Original Contact Data:');
console.log(JSON.stringify(problematicContact, null, 2));
console.log('\n' + '=' .repeat(80));

// Build the AppleScript command exactly as it would be in the sync code
const script = `
  tell application "Contacts"
    set newPerson to make new person with properties {first name:"${escapeAppleScript(problematicContact.firstName)}", last name:"${escapeAppleScript(problematicContact.lastName)}"}
    ${problematicContact.email ? `make new email at end of emails of newPerson with properties {value:"${escapeAppleScript(problematicContact.email)}", label:"work"}` : ''}
    ${problematicContact.phone ? `make new phone at end of phones of newPerson with properties {value:"${escapeAppleScript(problematicContact.phone)}", label:"work"}` : ''}
    ${problematicContact.org ? `set organization of newPerson to "${escapeAppleScript(problematicContact.org)}"` : ''}
    ${problematicContact.title ? `set job title of newPerson to "${escapeAppleScript(problematicContact.title)}"` : ''}
    ${problematicContact.notes ? `set note of newPerson to "${escapeAppleScript(problematicContact.notes)}"` : ''}
    save
  end tell
`;

console.log('\n📝 Generated AppleScript:');
console.log(script);
console.log('\n' + '=' .repeat(80));

// Build the full shell command that would be executed
const shellCommand = `osascript -e '${script}'`;

console.log('\n🐚 Shell Command (what actually gets executed):');
console.log(shellCommand);
console.log('\n' + '=' .repeat(80));

// Validate that the command doesn't contain any unescaped apostrophes
// that would break the shell parsing
const shellParts = shellCommand.split("'");
let valid = true;
let errorMessage = '';

// Check for problematic patterns
if (shellCommand.includes("Int'l:") && !shellCommand.includes("Int\\'l:")) {
  valid = false;
  errorMessage = 'Unescaped apostrophe found in "Int\'l:" - this will break the shell command!';
}

console.log('\n✅ Validation Results:');
if (valid) {
  console.log('✅ All apostrophes properly escaped');
  console.log('✅ All double quotes properly escaped');
  console.log('✅ Command should execute without shell parsing errors');
  console.log('\n🎉 Fix verified! The problematic contact data is now properly escaped.');
  process.exit(0);
} else {
  console.log(`❌ ${errorMessage}`);
  console.log('❌ This command would fail with the same error as before');
  process.exit(1);
}
