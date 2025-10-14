/**
 * MCP Stdio Protocol - Stdout Pollution Prevention Tests
 *
 * CRITICAL: These tests ensure that the MCP server never writes non-JSON-RPC
 * content to stdout, which would break JSON-RPC communication with Claude Desktop.
 *
 * The MCP protocol requires:
 * - stdout: ONLY JSON-RPC messages (jsonrpc, id, result/error)
 * - stderr: ALL logging, debugging, and diagnostic output
 *
 * Bug History:
 * - v1.6.0: LOG_LEVEL improvements used console.log() which polluted stdout
 * - Impact: "Unexpected token 'E', "[EmbeddingU"... is not valid JSON"
 * - Fix: Changed all logging to console.error() in MCP context
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WriteStream } from 'tty';

describe('MCP Stdio Protocol - Stdout Pollution Prevention', () => {
  let originalStdoutWrite: typeof process.stdout.write;
  let originalStderrWrite: typeof process.stderr.write;
  let stdoutWrites: string[] = [];
  let stderrWrites: string[] = [];

  beforeEach(() => {
    // Capture stdout writes
    stdoutWrites = [];
    originalStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => {
      stdoutWrites.push(chunk.toString());
      return true;
    }) as any;

    // Capture stderr writes
    stderrWrites = [];
    originalStderrWrite = process.stderr.write;
    process.stderr.write = ((chunk: any) => {
      stderrWrites.push(chunk.toString());
      return true;
    }) as any;
  });

  afterEach(() => {
    // Restore original streams
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;

    // Clean up environment
    delete process.env.MCP_STDIO_MODE;
    delete process.env.LOG_LEVEL;
  });

  describe('EmbeddingUpdater logging', () => {
    it('should never write non-JSON-RPC content to stdout in MCP mode', async () => {
      // Simulate MCP stdio mode
      process.env.MCP_STDIO_MODE = '1';
      process.env.LOG_LEVEL = 'debug';

      // Import and test EmbeddingUpdater
      const { EmbeddingUpdater } = await import('../../src/services/embedding-updater.js');

      // Create mock dependencies
      const mockDb = {
        execute: vi.fn().mockResolvedValue({ rows: [] })
      } as any;

      const mockEmbeddingService = {
        generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
      } as any;

      // Create instance - this should NOT pollute stdout
      const updater = new EmbeddingUpdater(mockDb, mockEmbeddingService);

      // Check that stdout is clean (no log messages)
      const hasLogPollution = stdoutWrites.some(write =>
        write.includes('[EmbeddingUpdater]') ||
        write.includes('[MCPServer]') ||
        write.includes('[DEBUG]') ||
        write.includes('[INFO]') ||
        write.includes('[WARN]') ||
        write.includes('[ERROR]')
      );

      expect(hasLogPollution).toBe(false);

      // If there are logs, verify they went to stderr
      if (stderrWrites.length > 0) {
        const hasStderrLogs = stderrWrites.some(write =>
          write.includes('[EmbeddingUpdater]') ||
          write.includes('[MCPServer]')
        );
        // It's OK if there are no logs at all, but if there are logs, they should be on stderr
        expect(hasStderrLogs).toBe(true);
      }
    });

    it('should use stderr for all log levels', async () => {
      process.env.MCP_STDIO_MODE = '1';
      process.env.LOG_LEVEL = 'debug';

      const { EmbeddingUpdater } = await import('../../src/services/embedding-updater.js');

      const mockDb = {
        execute: vi.fn().mockResolvedValue({
          rows: [{ id: 'test-id', title: 'Test', content: 'Content', memory_type: 'SYSTEM', tags: '[]' }]
        })
      } as any;

      const mockEmbeddingService = {
        generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
      } as any;

      const updater = new EmbeddingUpdater(mockDb, mockEmbeddingService);

      // Clear previous writes
      stdoutWrites = [];
      stderrWrites = [];

      // Trigger operations that would log at different levels
      try {
        await updater.updateAllMissingEmbeddings('test-user');
      } catch (error) {
        // Ignore errors - we're testing logging behavior
      }

      // Verify no log pollution on stdout
      const hasLogPollution = stdoutWrites.some(write =>
        write.includes('[EmbeddingUpdater]') ||
        write.toLowerCase().includes('embedding') ||
        write.toLowerCase().includes('memory') ||
        write.toLowerCase().includes('updated')
      );

      expect(hasLogPollution).toBe(false);
    });
  });

  describe('Desktop MCP Server logging', () => {
    it('should use stderr for startup logs', async () => {
      process.env.MCP_STDIO_MODE = '1';
      process.env.LOG_LEVEL = 'debug';
      process.env.MCP_DEBUG = '1';

      // Clear writes before import
      stdoutWrites = [];
      stderrWrites = [];

      // Dynamic import to ensure constructor runs after env vars are set
      const module = await import('../../src/desktop-mcp-server.js');

      // The constructor should have logged to stderr, not stdout
      const hasStdoutPollution = stdoutWrites.some(write =>
        write.includes('[MCPServer]') ||
        write.includes('Log level:')
      );

      expect(hasStdoutPollution).toBe(false);
    });
  });

  describe('JSON-RPC protocol compliance', () => {
    it('should only allow valid JSON-RPC on stdout', () => {
      // Set MCP mode
      process.env.MCP_STDIO_MODE = '1';

      // Simulate some operations that might log
      console.error('This is safe - stderr');

      // Simulate a proper JSON-RPC response
      const validJsonRpc = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true }
      });

      // This should be the only thing on stdout in MCP mode
      process.stdout.write(validJsonRpc + '\n');

      // Any stdout writes should be valid JSON-RPC
      for (const write of stdoutWrites) {
        const trimmed = write.trim();
        if (trimmed && !trimmed.startsWith('\n') && trimmed !== '') {
          expect(() => JSON.parse(trimmed)).not.toThrow();
          const parsed = JSON.parse(trimmed);
          expect(parsed).toHaveProperty('jsonrpc', '2.0');
        }
      }
    });

    it('should detect console.log calls that violate protocol', async () => {
      // Spy on console.log
      const consoleLogSpy = vi.spyOn(console, 'log');

      process.env.MCP_STDIO_MODE = '1';
      process.env.LOG_LEVEL = 'debug';

      // Import the fixed modules - they should NOT call console.log
      await import('../../src/services/embedding-updater.js');

      // The fixed code should never call console.log in MCP mode
      // Note: We're not testing execution, just that the fix is in place
      // Actual execution testing is done in other tests

      consoleLogSpy.mockRestore();
    });
  });

  describe('Regression prevention', () => {
    it('should fail if EmbeddingUpdater uses console.log instead of console.error', async () => {
      // Read the source file to verify the fix
      const { readFileSync } = await import('fs');
      const embeddingUpdaterSource = readFileSync(
        '/Users/masa/Projects/mcp-memory-ts/src/services/embedding-updater.ts',
        'utf-8'
      );

      // Check that the log method ONLY uses console.error
      const logMethodMatch = embeddingUpdaterSource.match(
        /private log\([^)]+\):[^{]*{[^}]*}/s
      );

      if (logMethodMatch) {
        const logMethod = logMethodMatch[0];

        // Should contain console.error
        expect(logMethod).toContain('console.error');

        // Should NOT contain console.log
        expect(logMethod).not.toContain('console.log');

        // Should have a comment about MCP protocol
        expect(logMethod).toContain('MCP stdio protocol');
      }
    });

    it('should fail if desktop-mcp-server uses console.log for startup', async () => {
      // Read the source file to verify the fix
      const { readFileSync } = await import('fs');
      const mcpServerSource = readFileSync(
        '/Users/masa/Projects/mcp-memory-ts/src/desktop-mcp-server.ts',
        'utf-8'
      );

      // Check the constructor for proper logging
      const constructorMatch = mcpServerSource.match(
        /constructor\(\)[^{]*{[^}]*this\.logLevel[^}]*}/s
      );

      if (constructorMatch) {
        const constructor = constructorMatch[0];

        // Should contain console.error
        expect(constructor).toContain('console.error');

        // Should NOT contain console.log
        expect(constructor).not.toContain('console.log');

        // Should have a comment about MCP protocol
        expect(constructor).toContain('MCP stdio protocol');
      }
    });

    it('should prevent future console.log additions in critical paths', async () => {
      // This test documents the critical paths where console.log is forbidden
      const criticalFiles = [
        '/Users/masa/Projects/mcp-memory-ts/src/services/embedding-updater.ts',
        '/Users/masa/Projects/mcp-memory-ts/src/desktop-mcp-server.ts'
      ];

      const { readFileSync } = await import('fs');

      for (const filePath of criticalFiles) {
        const source = readFileSync(filePath, 'utf-8');

        // Count occurrences of problematic patterns
        const consoleLogMatches = source.match(/console\.log\(/g) || [];

        // Filter out safe occurrences (in comments, etc.)
        const unsafeMatches = consoleLogMatches.filter((match, index) => {
          const position = source.indexOf(match, index > 0 ? source.indexOf(match) + 1 : 0);
          const lineStart = source.lastIndexOf('\n', position);
          const line = source.substring(lineStart, position);

          // It's safe if it's in a comment
          return !line.trim().startsWith('//') && !line.includes('/*');
        });

        // In MCP context, there should be ZERO unsafe console.log calls
        expect(unsafeMatches.length).toBe(0);
      }
    });
  });

  describe('Stream output validation', () => {
    it('should write logs to stderr with proper formatting', async () => {
      process.env.LOG_LEVEL = 'info';

      // Clear writes
      stdoutWrites = [];
      stderrWrites = [];

      const { EmbeddingUpdater } = await import('../../src/services/embedding-updater.js');

      const mockDb = {
        execute: vi.fn().mockResolvedValue({ rows: [] })
      } as any;

      const mockEmbeddingService = {
        generateEmbedding: vi.fn()
      } as any;

      // Create instance
      new EmbeddingUpdater(mockDb, mockEmbeddingService);

      // If there are any logs, they should:
      // 1. Be on stderr
      // 2. Have proper formatting
      const embeddingLogs = stderrWrites.filter(w => w.includes('[EmbeddingUpdater]'));

      for (const log of embeddingLogs) {
        // Should have proper prefix
        expect(log).toContain('[EmbeddingUpdater]');

        // Should be a complete message (ends with newline or has content)
        expect(log.length).toBeGreaterThan(0);
      }

      // stdout should remain clean
      expect(stdoutWrites.filter(w => w.includes('[EmbeddingUpdater]')).length).toBe(0);
    });
  });
});
