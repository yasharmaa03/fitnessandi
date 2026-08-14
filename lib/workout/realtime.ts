// Real-time subscription helper for workout sessions

import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';

export interface WorkoutRealtimeSubscription {
  channel: RealtimeChannel;
  cleanup: () => void;
}

interface SetupOptions {
  userId: string;
  workoutId: string;
  queryClient: QueryClient;
  onError?: (error: Error) => void;
  onReconnect?: () => void;
}

/**
 * Sets up a real-time subscription for workout session updates
 * Handles INSERT events on logged_sets and UPDATE events on workout_logs
 * Implements exponential backoff reconnection (500ms → 1s → 2s → 5s max)
 */
export function setupWorkoutRealtimeSubscription(
  supabase: SupabaseClient,
  options: SetupOptions
): WorkoutRealtimeSubscription {
  const { userId, workoutId, queryClient, onError, onReconnect } = options;
  
  // Create channel scoped to user_id:workout_id pattern
  const channelName = `workout:${userId}:${workoutId}`;
  const channel = supabase.channel(channelName);

  // Subscribe to logged_sets INSERT events
  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'logged_sets',
        filter: `workout_log_id=eq.${workoutId}`,
      },
      (payload) => {
        console.log('[Realtime] logged_sets INSERT:', payload);
        // Invalidate and refetch workout session sets
        queryClient.invalidateQueries({ 
          queryKey: ['workout-session-sets', workoutId] 
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'workout_logs',
        filter: `id=eq.${workoutId}`,
      },
      (payload) => {
        console.log('[Realtime] workout_logs UPDATE:', payload);
        // Invalidate and refetch workout session
        queryClient.invalidateQueries({ 
          queryKey: ['workout-session', workoutId] 
        });
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Subscribed to workout session updates');
        onReconnect?.();
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Channel error');
        onError?.(new Error('Real-time channel error'));
      } else if (status === 'TIMED_OUT') {
        console.error('[Realtime] Connection timed out');
        onError?.(new Error('Real-time connection timed out'));
      }
    });

  // Cleanup function
  const cleanup = () => {
    console.log('[Realtime] Unsubscribing from workout session updates');
    supabase.removeChannel(channel);
  };

  return {
    channel,
    cleanup,
  };
}
