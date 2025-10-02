# Verification Checklist

Use this checklist to verify the CLI package is working correctly.

## Build Verification

- [ ] Project builds without errors: `npm run build-full`
- [ ] CLI binary exists: `ls dist/cli/index.js`
- [ ] MCP server exists: `ls dist/simple-mcp-server.js`
- [ ] CLI modules compiled: `ls dist/cli/claude-desktop.js dist/cli/init.js`

## Installation Verification

- [ ] Package linked globally: `npm link`
- [ ] CLI available in PATH: `which mcp-memory`
- [ ] CLI version correct: `mcp-memory --version` shows 1.1.3
- [ ] Help command works: `mcp-memory --help`

## Command Verification

### Configuration Commands
- [ ] Init command available: `mcp-memory init --help`
- [ ] Config command available: `mcp-memory config --help`

### Claude Desktop Commands
- [ ] Claude Desktop help: `mcp-memory claude-desktop --help`
- [ ] Install command available: `mcp-memory claude-desktop install --help`
- [ ] Update command available: `mcp-memory claude-desktop update --help`
- [ ] Status command available: `mcp-memory claude-desktop status --help`
- [ ] Uninstall command available: `mcp-memory claude-desktop uninstall --help`

### vCard Commands
- [ ] Export command available: `mcp-memory export-vcard --help`
- [ ] Import command available: `mcp-memory import-vcard --help`
- [ ] List types available: `mcp-memory list-types`

## Automated Tests

- [ ] All CLI tests pass: `npm run cli:test`

## Functional Verification (Optional - requires credentials)

### Configuration
- [ ] Run init wizard: `mcp-memory init`
- [ ] Enter valid credentials
- [ ] Turso connection validates
- [ ] OpenAI key validates
- [ ] Config saved to `~/.mcp-memory/config.json`
- [ ] Config file has correct structure
- [ ] Config command shows data: `mcp-memory config`

### Claude Desktop Integration
- [ ] Status before install shows "not found": `mcp-memory claude-desktop status`
- [ ] Install completes successfully: `mcp-memory claude-desktop install`
- [ ] Backup created: `~/Library/Application Support/Claude/claude_desktop_config.json.backup`
- [ ] Config updated: `~/Library/Application Support/Claude/claude_desktop_config.json`
- [ ] Config contains mcp-memory-ts entry
- [ ] Status shows all green: `mcp-memory claude-desktop status`

### Claude Desktop Runtime
- [ ] Restart Claude Desktop
- [ ] MCP tools available in Claude
- [ ] Can use memory tools
- [ ] No errors in Claude Desktop logs

### Update Process
- [ ] Make code change
- [ ] Rebuild: `npm run build-full`
- [ ] Update config: `mcp-memory claude-desktop update`
- [ ] Restart Claude Desktop
- [ ] Changes reflected

### Uninstall
- [ ] Uninstall runs: `mcp-memory claude-desktop uninstall`
- [ ] Entry removed from Claude Desktop config
- [ ] User config preserved: `~/.mcp-memory/config.json` still exists
- [ ] Status shows "not installed"

## Documentation Verification

- [ ] README.md exists and is up to date
- [ ] CLI-GUIDE.md exists with complete documentation
- [ ] INSTALL.md exists with step-by-step guide
- [ ] QUICK-START.md exists with quick commands
- [ ] CLI-PACKAGE-SUMMARY.md exists with implementation details
- [ ] VERIFICATION-CHECKLIST.md (this file) exists

## Code Quality

- [ ] TypeScript compiles with no errors
- [ ] No console errors during execution
- [ ] Error messages are clear and helpful
- [ ] Success messages are clear
- [ ] Prompts are user-friendly
- [ ] Help text is comprehensive

## Edge Cases

- [ ] Running init twice asks for confirmation
- [ ] Installing when already installed works
- [ ] Uninstalling when not installed handles gracefully
- [ ] Status command never crashes
- [ ] Config command handles missing config
- [ ] Commands fail gracefully with clear errors

## Developer Experience

- [ ] `npm link` works for local development
- [ ] Can unlink: `npm unlink -g mcp-memory-ts`
- [ ] Can relink after changes
- [ ] Development workflow is smooth
- [ ] Documentation is clear

## Results

Date: _______________
Tester: ______________

Pass: _____ / _____
Fail: _____ / _____

Notes:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

## Sign-off

✅ Package is ready for use
□ Issues found (see notes)
□ Additional work needed

Signature: _______________
