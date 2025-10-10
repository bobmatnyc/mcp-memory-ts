/**
 * Week Calculator Utilities
 *
 * Utilities for calculating week identifiers and date ranges.
 * Uses ISO 8601 week date system for consistency.
 */

import { createWeekIdentifier, type WeekIdentifier } from '../types/google.js';

/**
 * Week date range
 */
export interface WeekDateRange {
  start: Date;
  end: Date;
  weekIdentifier: WeekIdentifier;
}

/**
 * Get week identifier for a given date (YYYY-WW format)
 *
 * Uses ISO 8601 week date system where:
 * - Week starts on Monday
 * - Week 1 is the first week with at least 4 days in the new year
 *
 * @param date - Date to get week identifier for
 * @returns Week identifier in YYYY-WW format
 */
export function getWeekIdentifier(date: Date = new Date()): WeekIdentifier {
  // Clone date to avoid mutation
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  // Set to nearest Thursday (current week's Thursday)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));

  // Get first day of year
  const yearStart = new Date(d.getFullYear(), 0, 1);

  // Calculate week number
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return createWeekIdentifier(`${d.getFullYear()}-${String(weekNumber).padStart(2, '0')}`);
}

/**
 * Get current week identifier
 *
 * @returns Current week identifier in YYYY-WW format
 */
export function getCurrentWeekIdentifier(): WeekIdentifier {
  return getWeekIdentifier(new Date());
}

/**
 * Get week start and end dates for a week identifier
 *
 * @param weekIdentifier - Week identifier in YYYY-WW format
 * @returns Week start (Monday) and end (Sunday) dates
 */
export function getWeekDates(weekIdentifier: WeekIdentifier | string): WeekDateRange {
  const [yearStr, weekStr] = weekIdentifier.split('-');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Get January 4th (always in week 1)
  const jan4 = new Date(year, 0, 4);

  // Get Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));

  // Calculate target week's Monday
  const weekStart = new Date(week1Monday);
  weekStart.setDate(week1Monday.getDate() + (week - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);

  // Calculate Sunday (end of week)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return {
    start: weekStart,
    end: weekEnd,
    weekIdentifier: createWeekIdentifier(weekIdentifier),
  };
}

/**
 * Get week identifier for next week
 *
 * @param weekIdentifier - Current week identifier
 * @returns Next week identifier
 */
export function getNextWeekIdentifier(weekIdentifier: WeekIdentifier | string): WeekIdentifier {
  const { start } = getWeekDates(weekIdentifier);
  const nextWeekStart = new Date(start);
  nextWeekStart.setDate(start.getDate() + 7);

  return getWeekIdentifier(nextWeekStart);
}

/**
 * Get week identifier for previous week
 *
 * @param weekIdentifier - Current week identifier
 * @returns Previous week identifier
 */
export function getPreviousWeekIdentifier(weekIdentifier: WeekIdentifier | string): WeekIdentifier {
  const { start } = getWeekDates(weekIdentifier);
  const prevWeekStart = new Date(start);
  prevWeekStart.setDate(start.getDate() - 7);

  return getWeekIdentifier(prevWeekStart);
}

/**
 * Get array of week identifiers for a date range
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Array of week identifiers
 */
export function getWeekIdentifiersForRange(startDate: Date, endDate: Date): WeekIdentifier[] {
  const weeks: WeekIdentifier[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    weeks.push(getWeekIdentifier(current));
    current.setDate(current.getDate() + 7);
  }

  return Array.from(new Set(weeks)); // Remove duplicates
}

/**
 * Check if a date falls within a week
 *
 * @param date - Date to check
 * @param weekIdentifier - Week identifier
 * @returns True if date is in the week
 */
export function isDateInWeek(date: Date, weekIdentifier: WeekIdentifier | string): boolean {
  const { start, end } = getWeekDates(weekIdentifier);
  return date >= start && date <= end;
}

/**
 * Format week identifier for display
 *
 * @param weekIdentifier - Week identifier
 * @returns Human-readable week string (e.g., "Week 42, 2025")
 */
export function formatWeekIdentifier(weekIdentifier: WeekIdentifier | string): string {
  const [year, week] = weekIdentifier.split('-');
  return `Week ${parseInt(week, 10)}, ${year}`;
}

/**
 * Parse human-readable week string to week identifier
 *
 * @param weekString - Week string (e.g., "Week 42, 2025" or "2025-42")
 * @returns Week identifier
 */
export function parseWeekString(weekString: string): WeekIdentifier {
  // Handle "Week XX, YYYY" format
  const match1 = weekString.match(/Week\s+(\d+),?\s+(\d{4})/i);
  if (match1) {
    const [, week, year] = match1;
    return createWeekIdentifier(`${year}-${String(week).padStart(2, '0')}`);
  }

  // Handle "YYYY-WW" format
  const match2 = weekString.match(/^(\d{4})-(\d{2})$/);
  if (match2) {
    return createWeekIdentifier(weekString);
  }

  throw new Error(`Invalid week string format: ${weekString}`);
}
