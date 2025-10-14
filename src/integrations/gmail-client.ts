/**
 * Gmail API Client
 *
 * Fetches emails from Gmail using Google OAuth2 credentials.
 * Supports date-based filtering for weekly extraction batches.
 */

import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';

export interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  date: Date;
  snippet: string;
  body: string;
  labels: string[];
  headers: Record<string, string>;
}

export interface EmailBatch {
  emails: Email[];
  totalCount: number;
  startDate: Date;
  endDate: Date;
}

export class GmailClient {
  private gmail: gmail_v1.Gmail;
  private auth: any;

  constructor(accessToken: string) {
    this.auth = new google.auth.OAuth2();
    this.auth.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
  }

  /**
   * Get emails for a specific week
   */
  async getEmailsForWeek(weekStart: Date, weekEnd: Date, maxResults = 100): Promise<EmailBatch> {
    try {
      // Build Gmail query for date range
      const query = this.buildDateQuery(weekStart, weekEnd);

      console.log(`Fetching emails from ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

      // List message IDs
      const listResponse = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages = listResponse.data.messages || [];
      console.log(`Found ${messages.length} messages`);

      if (messages.length === 0) {
        return {
          emails: [],
          totalCount: 0,
          startDate: weekStart,
          endDate: weekEnd,
        };
      }

      // Fetch full message details
      const emails: Email[] = [];
      for (const message of messages) {
        if (!message.id) continue;

        try {
          const email = await this.getEmail(message.id);
          if (email) {
            emails.push(email);
          }
        } catch (error) {
          console.error(`Failed to fetch email ${message.id}:`, error);
          // Continue with other emails
        }
      }

      return {
        emails,
        totalCount: emails.length,
        startDate: weekStart,
        endDate: weekEnd,
      };
    } catch (error) {
      console.error('Failed to fetch emails:', error);
      throw new Error(
        `Gmail API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a single email by ID
   */
  private async getEmail(messageId: string): Promise<Email | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      if (!message.payload) return null;

      const headers = this.parseHeaders(message.payload.headers || []);
      const body = this.extractBody(message.payload);

      return {
        id: message.id || '',
        threadId: message.threadId || '',
        subject: headers['subject'] || '(No Subject)',
        from: headers['from'] || '',
        to: this.parseEmailList(headers['to']),
        cc: this.parseEmailList(headers['cc']),
        date: new Date(headers['date'] || message.internalDate || Date.now()),
        snippet: message.snippet || '',
        body,
        labels: message.labelIds || [],
        headers,
      };
    } catch (error) {
      console.error(`Failed to get email ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Build Gmail query for date range
   */
  private buildDateQuery(start: Date, end: Date): string {
    const startStr = this.formatDateForQuery(start);
    const endStr = this.formatDateForQuery(end);

    // Exclude spam and trash
    return `after:${startStr} before:${endStr} -in:spam -in:trash`;
  }

  /**
   * Format date for Gmail query (YYYY/MM/DD)
   */
  private formatDateForQuery(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  /**
   * Parse email headers into a map
   */
  private parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[]): Record<string, string> {
    const headerMap: Record<string, string> = {};

    for (const header of headers) {
      if (header.name && header.value) {
        headerMap[header.name.toLowerCase()] = header.value;
      }
    }

    return headerMap;
  }

  /**
   * Extract email body from message payload
   */
  private extractBody(payload: gmail_v1.Schema$MessagePart): string {
    let body = '';

    if (payload.body?.data) {
      body = this.decodeBase64(payload.body.data);
    } else if (payload.parts) {
      // Try to find text/plain or text/html part
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = this.decodeBase64(part.body.data);
          break;
        }
      }

      // Fallback to HTML if no plain text
      if (!body) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/html' && part.body?.data) {
            body = this.decodeBase64(part.body.data);
            break;
          }
        }
      }

      // Recursive search in nested parts
      if (!body) {
        for (const part of payload.parts) {
          if (part.parts) {
            body = this.extractBody(part);
            if (body) break;
          }
        }
      }
    }

    return this.cleanEmailBody(body);
  }

  /**
   * Decode base64url encoded data
   */
  private decodeBase64(data: string): string {
    try {
      // Gmail uses base64url encoding (- instead of +, _ instead of /)
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(base64, 'base64').toString('utf-8');
    } catch (error) {
      console.error('Failed to decode base64:', error);
      return '';
    }
  }

  /**
   * Clean email body (strip HTML, excessive whitespace, etc.)
   */
  private cleanEmailBody(body: string): string {
    if (!body) return '';

    // Remove HTML tags
    let cleaned = body.replace(/<[^>]*>/g, ' ');

    // Decode HTML entities
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Limit length to prevent token overload
    const maxLength = 10000;
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength) + '... [truncated]';
    }

    return cleaned;
  }

  /**
   * Parse comma-separated email list
   */
  private parseEmailList(emailStr: string | undefined): string[] {
    if (!emailStr) return [];

    return emailStr
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);
  }

  /**
   * Test connection and permissions
   */
  async testConnection(): Promise<{ success: boolean; email?: string; error?: string }> {
    try {
      const profile = await this.gmail.users.getProfile({ userId: 'me' });

      return {
        success: true,
        email: profile.data.emailAddress || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get week start and end dates for a week identifier (YYYY-WW format)
 */
export function getWeekDates(weekIdentifier: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekIdentifier.split('-');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  // Get first day of year
  const jan1 = new Date(year, 0, 1);

  // Find first Monday of the year
  const dayOfWeek = jan1.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
  const firstMonday = new Date(year, 0, 1 + daysToMonday);

  // Calculate start of target week
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);

  // Calculate end of target week (Sunday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { start: weekStart, end: weekEnd };
}

/**
 * Get week identifier for a given date (YYYY-WW format)
 */
export function getWeekIdentifier(date: Date): string {
  const year = date.getFullYear();

  // Get first day of year
  const jan1 = new Date(year, 0, 1);

  // Calculate week number
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);

  return `${year}-${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Get current week identifier
 */
export function getCurrentWeekIdentifier(): string {
  return getWeekIdentifier(new Date());
}
