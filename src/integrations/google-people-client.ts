/**
 * Google People API Client
 *
 * Wrapper for Google People API (Contacts) with incremental sync support.
 * Implements syncToken-based incremental updates to minimize API calls.
 */

import { google, people_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GoogleContactId, SyncResult, SyncError } from '../types/google.js';
import { CONTACT_FIELD_MASK, createGoogleContactId } from '../types/google.js';

export { CONTACT_FIELD_MASK };

/**
 * Simplified Google Contact structure
 */
export interface GoogleContact {
  id: GoogleContactId;
  resourceName: string;
  etag: string;
  names?: people_v1.Schema$Name[];
  emailAddresses?: people_v1.Schema$EmailAddress[];
  phoneNumbers?: people_v1.Schema$PhoneNumber[];
  addresses?: people_v1.Schema$Address[];
  organizations?: people_v1.Schema$Organization[];
  biographies?: people_v1.Schema$Biography[];
  urls?: people_v1.Schema$Url[];
  metadata?: people_v1.Schema$PersonMetadata;
}

/**
 * List contacts response
 */
export interface ListContactsResponse {
  contacts: GoogleContact[];
  nextSyncToken: string;
  nextPageToken?: string;
  totalItems?: number; // Total available contacts (if provided by Google API)
}

/**
 * Google People API Client
 *
 * Features:
 * - Incremental sync with syncToken
 * - Batch operations
 * - Error handling with retry logic
 * - Rate limit management
 * - Timeout protection
 */
export class GooglePeopleClient {
  private people: people_v1.People;
  private readonly API_TIMEOUT_MS = 30000; // 30 seconds

  constructor(private auth: OAuth2Client) {
    this.people = google.people({ version: 'v1', auth });
  }

  /**
   * List contacts with optional incremental sync
   *
   * @param syncToken - Optional sync token for incremental updates
   * @param pageSize - Number of contacts per page (max 1000)
   * @returns Sync result with contacts and next sync token
   */
  async listContacts(
    syncToken?: string,
    pageSize = 200
  ): Promise<SyncResult<ListContactsResponse>> {
    try {
      const params: people_v1.Params$Resource$People$Connections$List = {
        resourceName: 'people/me',
        pageSize,
        personFields: CONTACT_FIELD_MASK,
        requestSyncToken: true,
      };

      if (syncToken) {
        // Incremental sync
        params.syncToken = syncToken;
      } else {
        // Full sync - sort by last modified
        params.sortOrder = 'LAST_MODIFIED_DESCENDING';
      }

      const response = await this.people.people.connections.list(params);

      // Log raw API response to check for totalPeople or totalItems
      process.stderr.write(`[GooglePeopleClient] Raw API response keys: ${JSON.stringify({
        hasConnections: !!response.data.connections,
        connectionCount: response.data.connections?.length || 0,
        hasNextPageToken: !!response.data.nextPageToken,
        hasNextSyncToken: !!response.data.nextSyncToken,
        hasTotalPeople: !!(response.data as any).totalPeople,
        hasTotalItems: !!(response.data as any).totalItems,
        totalPeople: (response.data as any).totalPeople,
        totalItems: (response.data as any).totalItems,
        allKeys: Object.keys(response.data),
      })}\n`);

      return {
        ok: true,
        data: {
          contacts: (response.data.connections || []).map(this.mapToPerson),
          nextSyncToken: response.data.nextSyncToken || '',
          nextPageToken: response.data.nextPageToken ?? undefined,
          // Include totalPeople if available from Google API
          totalItems: (response.data as any).totalPeople ?? (response.data as any).totalItems,
        },
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Get all contacts (handles pagination automatically)
   *
   * @param syncToken - Optional sync token for incremental updates
   * @returns Sync result with all contacts and next sync token
   */
  async getAllContacts(syncToken?: string): Promise<SyncResult<ListContactsResponse>> {
    const allContacts: GoogleContact[] = [];
    let nextPageToken: string | undefined;
    let finalSyncToken = '';

    try {
      console.log('[GooglePeopleClient] Starting getAllContacts with syncToken:', !!syncToken);
      const startTime = Date.now();

      do {
        const params: people_v1.Params$Resource$People$Connections$List = {
          resourceName: 'people/me',
          pageSize: 1000,
          personFields: CONTACT_FIELD_MASK,
          requestSyncToken: true,
          pageToken: nextPageToken,
        };

        if (syncToken) {
          params.syncToken = syncToken;
        } else {
          params.sortOrder = 'LAST_MODIFIED_DESCENDING';
        }

        console.log('[GooglePeopleClient] Calling People API (page)...');

        // Call with timeout protection
        const response = await this.callWithTimeout(
          this.people.people.connections.list(params),
          `Google People API connections.list`
        );

        const connections = response.data.connections || [];
        console.log('[GooglePeopleClient] Received', connections.length, 'contacts in page');

        allContacts.push(...connections.map(this.mapToPerson));
        nextPageToken = response.data.nextPageToken ?? undefined;
        finalSyncToken = response.data.nextSyncToken || finalSyncToken;
      } while (nextPageToken);

      const duration = Date.now() - startTime;
      console.log('[GooglePeopleClient] getAllContacts completed:', {
        totalContacts: allContacts.length,
        durationMs: duration,
        hasSyncToken: !!finalSyncToken,
      });

      return {
        ok: true,
        data: {
          contacts: allContacts,
          nextSyncToken: finalSyncToken,
        },
      };
    } catch (error: any) {
      console.error('[GooglePeopleClient] getAllContacts error:', {
        message: error.message,
        code: error.code,
        type: error.constructor.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      });
      return this.handleError(error);
    }
  }

  /**
   * Wrap API call with timeout protection
   */
  private async callWithTimeout<T>(promise: Promise<T>, operationName: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `${operationName} timed out after ${this.API_TIMEOUT_MS}ms. Please try again or check your internet connection.`
          )
        );
      }, this.API_TIMEOUT_MS);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Create a new contact
   *
   * @param contact - Contact data to create
   * @returns Sync result with created contact
   */
  async createContact(contact: Partial<GoogleContact>): Promise<SyncResult<GoogleContact>> {
    try {
      const response = await this.people.people.createContact({
        requestBody: contact,
      });

      return {
        ok: true,
        data: this.mapToPerson(response.data),
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Update an existing contact
   *
   * @param resourceName - Google resource name (e.g., "people/123")
   * @param contact - Contact data to update
   * @param updateMask - Fields to update
   * @returns Sync result with updated contact
   */
  async updateContact(
    resourceName: string,
    contact: Partial<GoogleContact>,
    updateMask: string[]
  ): Promise<SyncResult<GoogleContact>> {
    try {
      const response = await this.people.people.updateContact({
        resourceName,
        updatePersonFields: updateMask.join(','),
        requestBody: contact,
      });

      return {
        ok: true,
        data: this.mapToPerson(response.data),
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Get a single contact by resource name
   *
   * @param resourceName - Google resource name (e.g., "people/123")
   * @returns Sync result with contact
   */
  async getContact(resourceName: string): Promise<SyncResult<GoogleContact>> {
    try {
      const response = await this.people.people.get({
        resourceName,
        personFields: CONTACT_FIELD_MASK,
      });

      return {
        ok: true,
        data: this.mapToPerson(response.data),
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Delete a contact
   *
   * @param resourceName - Google resource name (e.g., "people/123")
   * @returns Sync result
   */
  async deleteContact(resourceName: string): Promise<SyncResult<void>> {
    try {
      await this.people.people.deleteContact({
        resourceName,
      });

      return { ok: true, data: undefined };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Batch get contacts by resource names
   *
   * @param resourceNames - Array of resource names
   * @returns Sync result with contacts
   */
  async batchGetContacts(resourceNames: string[]): Promise<SyncResult<GoogleContact[]>> {
    try {
      const response = await this.people.people.getBatchGet({
        resourceNames,
        personFields: CONTACT_FIELD_MASK,
      });

      const contacts = (response.data.responses || [])
        .map(r => r.person)
        .filter(Boolean)
        .map(this.mapToPerson);

      return { ok: true, data: contacts };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Map Google API response to GoogleContact
   */
  private mapToPerson(person: any): GoogleContact {
    return {
      id: createGoogleContactId(person.resourceName?.split('/').pop() || ''),
      resourceName: person.resourceName || '',
      etag: person.etag || '',
      names: person.names,
      emailAddresses: person.emailAddresses,
      phoneNumbers: person.phoneNumbers,
      addresses: person.addresses,
      organizations: person.organizations,
      biographies: person.biographies,
      urls: person.urls,
      metadata: person.metadata,
    };
  }

  /**
   * Handle Google API errors and convert to SyncError
   */
  private handleError<T>(error: any): { ok: false; error: SyncError } {
    // Log raw error for debugging
    console.error('[GooglePeopleClient] Raw error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.response?.status || error.statusCode,
      statusText: error.response?.statusText,
      errorType: error.constructor.name,
      hasResponse: !!error.response,
      responseData: error.response?.data,
    });

    const statusCode = error.code || error.response?.status || error.statusCode;

    // Sync token expired (HTTP 410 Gone)
    if (statusCode === 410 || error.message?.includes('Sync token expired')) {
      return {
        ok: false,
        error: {
          type: 'EXPIRED_SYNC_TOKEN',
          message: 'Sync token expired, full sync required',
          statusCode,
        },
      };
    }

    // Rate limit exceeded (HTTP 429 or 403 with rate limit)
    if (statusCode === 429 || (statusCode === 403 && error.message?.includes('rate'))) {
      const retryAfter = parseInt(error.response?.headers['retry-after'] || '60', 10);
      return {
        ok: false,
        error: {
          type: 'RATE_LIMIT',
          retryAfter,
          message: `Rate limit exceeded, retry after ${retryAfter}s`,
          statusCode,
        },
      };
    }

    // Authentication error (HTTP 401 or 403)
    if (statusCode === 401 || statusCode === 403) {
      return {
        ok: false,
        error: {
          type: 'AUTH_ERROR',
          message: `Authentication failed (${statusCode}): ${error.message || 'Token may be invalid or revoked'}`,
          statusCode,
        },
      };
    }

    // Timeout errors
    if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
      return {
        ok: false,
        error: {
          type: 'NETWORK_ERROR',
          message: error.message,
        },
      };
    }

    // Network or other errors
    return {
      ok: false,
      error: {
        type: 'NETWORK_ERROR',
        message: error.message || 'Unknown error occurred',
        statusCode,
      },
    };
  }
}
