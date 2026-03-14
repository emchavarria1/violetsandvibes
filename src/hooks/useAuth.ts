import { useState, useEffect, useCallback } from 'react';
import { getFreshSession, supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUserFromSession = useCallback(
    async (options?: { forceRefresh?: boolean; keepLoading?: boolean }) => {
      if (options?.keepLoading) {
        setLoading(true);
      }

      try {
        const session = await getFreshSession({ forceRefresh: options?.forceRefresh });
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error refreshing session:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let active = true;

    const syncIfActive = async (options?: { forceRefresh?: boolean; keepLoading?: boolean }) => {
      if (options?.keepLoading && active) {
        setLoading(true);
      }

      try {
        const session = await getFreshSession({ forceRefresh: options?.forceRefresh });
        if (!active) return;
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void syncIfActive({ keepLoading: true });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(session?.user ?? null);
      setLoading(false);
    });

    const handleForegroundRefresh = () => {
      if (!active) return;
      if (document.visibilityState !== 'visible') return;
      void syncIfActive();
    };

    window.addEventListener('focus', handleForegroundRefresh);
    document.addEventListener('visibilitychange', handleForegroundRefresh);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', handleForegroundRefresh);
      document.removeEventListener('visibilitychange', handleForegroundRefresh);
    };
  }, []);

  return {
    user,
    loading,
    refreshSession: syncUserFromSession,
    signOut: () => supabase.auth.signOut(),
  };
};
