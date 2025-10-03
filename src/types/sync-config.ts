/**
 * Sync Configuration Types
 * Configuration for bidirectional contact sync with deduplication
 */

import type { DeduplicationConfig } from '../utils/deduplication.js';
import type { ConflictResolutionConfig } from '../utils/conflict-resolution.js';

/**
 * User configuration (stored in ~/.mcp-memory/config.json)
 */
export interface UserConfig {
  userEmail: string;
  tursoUrl: string;
  tursoAuthToken: string;
  openaiApiKey: string;
  sync?: SyncConfig;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  deduplication: DeduplicationConfig;
  conflictResolution: ConflictResolutionConfig;
}

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  deduplication: {
    threshold: 90,
    chatgptModel: 'gpt-4o',
    enableLLMDeduplication: true,
    maxRetries: 3,
    retryDelayMs: 1000,
  },
  conflictResolution: {
    strategy: 'newest',
    autoMerge: true,
    preferredSource: undefined,
  },
};
