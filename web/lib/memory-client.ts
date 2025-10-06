/**
 * @deprecated This file is deprecated.
 *
 * The MemoryCore singleton pattern has been replaced with per-request instances
 * that use user-specific credentials from Clerk metadata.
 *
 * New implementation:
 * - Each user stores their own Turso and OpenAI credentials in Clerk user metadata
 * - Database connections are created per-request with user credentials
 * - MemoryCore instances are created per-request (no singleton)
 *
 * See lib/auth.ts for the new getMemoryCore() implementation.
 * See lib/user-metadata.ts for credential management functions.
 */

export {};
