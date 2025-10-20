/**
 * Google Integration Types
 *
 * Type definitions for Google Contacts and Calendar sync integration.
 * Uses branded types for type safety and Result types for error handling.
 */

// Branded types for Google IDs
export type GoogleContactId = string & { readonly __brand: 'GoogleContactId' };
export type GoogleEventId = string & { readonly __brand: 'GoogleEventId' };
export type WeekIdentifier = string & { readonly __brand: 'WeekIdentifier' }; // Format: YYYY-WW

/**
 * Google OAuth token storage
 */
export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Google API error types
 */
export type SyncError =
  | { type: 'EXPIRED_SYNC_TOKEN'; message: string; statusCode?: number }
  | { type: 'RATE_LIMIT'; retryAfter: number; message: string; statusCode?: number }
  | { type: 'NETWORK_ERROR'; message: string; statusCode?: number }
  | { type: 'AUTH_ERROR'; message: string; statusCode?: number }
  | { type: 'VALIDATION_ERROR'; message: string; statusCode?: number };

/**
 * Result type for Google operations
 */
export type SyncResult<T> =
  | { ok: true; data: T; syncToken?: string }
  | { ok: false; error: SyncError };

/**
 * Type guard to check if result is an error
 */
export function isError<T>(result: SyncResult<T>): result is { ok: false; error: SyncError } {
  return !result.ok;
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T>(result: SyncResult<T>): result is { ok: true; data: T; syncToken?: string } {
  return result.ok;
}

/**
 * OAuth scope definitions
 */
export const GOOGLE_SCOPES = {
  CONTACTS_READONLY: 'https://www.googleapis.com/auth/contacts.readonly',
  CONTACTS: 'https://www.googleapis.com/auth/contacts',
  CALENDAR_READONLY: 'https://www.googleapis.com/auth/calendar.readonly',
  CALENDAR: 'https://www.googleapis.com/auth/calendar',
  GMAIL_READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
} as const;

/**
 * Google Contact field mask for API requests
 */
export const CONTACT_FIELD_MASK = [
  'names',
  'emailAddresses',
  'phoneNumbers',
  'addresses',
  'organizations',
  'biographies',
  'urls',
  'metadata',
].join(',');

/**
 * Helper to create branded GoogleContactId
 */
export function createGoogleContactId(id: string): GoogleContactId {
  return id as GoogleContactId;
}

/**
 * Helper to create branded GoogleEventId
 */
export function createGoogleEventId(id: string): GoogleEventId {
  return id as GoogleEventId;
}

/**
 * Helper to create branded WeekIdentifier
 */
export function createWeekIdentifier(id: string): WeekIdentifier {
  return id as WeekIdentifier;
}
