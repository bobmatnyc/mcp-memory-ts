'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, ChevronLeft, ChevronRight, Users, MapPin, Clock, RefreshCw } from 'lucide-react';

interface GoogleCalendarSyncProps {
  onSyncComplete?: (result: CalendarSyncResult) => void;
}

interface CalendarSyncResult {
  success: boolean;
  eventsSynced: number;
  weekIdentifier: string;
  errors: string[];
}

interface CalendarEvent {
  eventId: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  isRecurring: boolean;
  status: string;
}

export function GoogleCalendarSync({ onSyncComplete }: GoogleCalendarSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<string>('');
  const [weekDisplay, setWeekDisplay] = useState<string>('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [result, setResult] = useState<CalendarSyncResult | null>(null);

  useEffect(() => {
    // Calculate current week
    const now = new Date();
    const weekId = getWeekIdentifier(now);
    setCurrentWeek(weekId);
    setWeekDisplay(formatWeekDisplay(now));
  }, []);

  const getWeekIdentifier = (date: Date): string => {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  };

  const formatWeekDisplay = (date: Date): string => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const [year, week] = currentWeek.split('-W').map(Number);
    const startOfYear = new Date(year, 0, 1);
    const currentWeekStart = new Date(startOfYear);
    currentWeekStart.setDate(startOfYear.getDate() + (week - 1) * 7);

    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));

    setCurrentWeek(getWeekIdentifier(newDate));
    setWeekDisplay(formatWeekDisplay(newDate));
    setEvents([]);
    setResult(null);
  };

  const handleSyncWeek = async () => {
    setSyncing(true);
    setResult(null);

    try {
      const response = await fetch('/api/google/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week: currentWeek,
          calendarId: 'primary',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        if (onSyncComplete) {
          onSyncComplete(data);
        }
        // Load events after sync
        loadEvents();
      } else {
        setResult({
          success: false,
          eventsSynced: 0,
          weekIdentifier: currentWeek,
          errors: [data.error || 'Unknown error'],
        });
      }
    } catch (error) {
      console.error('Failed to sync calendar:', error);
      setResult({
        success: false,
        eventsSynced: 0,
        weekIdentifier: currentWeek,
        errors: [error instanceof Error ? error.message : 'Failed to sync calendar'],
      });
    } finally {
      setSyncing(false);
    }
  };

  const loadEvents = async () => {
    if (!currentWeek) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/google/calendar/events?week=${currentWeek}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatEventTime = (startTime: string, endTime: string): string => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  };

  const formatEventDate = (dateTime: string): string => {
    const date = new Date(dateTime);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar Sync
        </CardTitle>
        <CardDescription>
          Sync calendar events with attendee tracking and entity linking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Week Selector */}
        <div className="space-y-2">
          <Label>Select Week</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center font-medium">
              {weekDisplay}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sync Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleSyncWeek}
            disabled={syncing || !currentWeek}
            className="flex-1"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing Week...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Week
              </>
            )}
          </Button>
          <Button
            onClick={loadEvents}
            disabled={loading || !currentWeek}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>View Events</>
            )}
          </Button>
        </div>

        {/* Sync Result */}
        {result && (
          <div className={`p-3 border rounded-lg ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-sm font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}>
              {result.success
                ? `Successfully synced ${result.eventsSynced} events`
                : 'Sync failed'}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 text-sm text-red-700 space-y-1">
                {result.errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Events List */}
        {events.length > 0 && (
          <div className="space-y-2">
            <Label>Events for {weekDisplay}</Label>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.map((event) => (
                <div
                  key={event.eventId}
                  className="p-3 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        {event.summary}
                        {event.isRecurring && (
                          <RefreshCw className="h-3 w-3 text-blue-600" />
                        )}
                      </h4>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatEventDate(event.startTime)}</span>
                          <span>•</span>
                          <span>{formatEventTime(event.startTime, event.endTime)}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        {event.attendees.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>
                              {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {event.description && (
                    <p className="mt-2 text-xs text-gray-600 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        )}

        {!loading && events.length === 0 && !result && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events loaded for this week</p>
            <p className="text-xs mt-1">Click "Sync Week" to load events</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
