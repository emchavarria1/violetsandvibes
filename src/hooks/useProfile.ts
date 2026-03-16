import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { findLocalDemoProfileById } from '@/lib/profiles';
import { useAuth } from './useAuth';

function calcAgeFromBirthdate(birthdate?: string | null) {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export const useProfile = (id?: string) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  const mapProfileRecord = (data: any) => ({
    ...data,
    user_id: data.id,
    name: data.full_name || data.username || 'Member',
    age: calcAgeFromBirthdate(data.birthdate),
    lgbtq_status: data.sexual_orientation,
    genderIdentity: data.gender_identity,
    sexualOrientation: data.sexual_orientation,
    lifestyle: data.lifestyle_interests || {},
    privacy: data.privacy_settings || {},
    safety: data.safety_settings || {},
    profileCompleted: !!data.profile_completed,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      // If this hook depends on current user (/profile) wait for auth to settle.
      if (!id && authLoading) return;

      try {
        setLoading(true);
        setError(null);
        
        // Use provided id or current user's id
        const userId = id || user?.id;
        
        if (!userId) {
          setProfile(null);
          setError(null);
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            const localDemoProfile = id ? await findLocalDemoProfileById(userId) : null;
            setProfile(localDemoProfile ? mapProfileRecord(localDemoProfile) : null);
          } else {
            throw fetchError;
          }
        } else {
          setProfile(mapProfileRecord(data));
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (id || user || !authLoading) {
      fetchProfile();
    } else {
      // Wait for auth resolution when no explicit id was provided.
      setLoading(true);
    }
  }, [id, user, authLoading]);

  const updateProfile = async (updates: any) => {
    if (!user) return { error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Refresh profile data
      setProfile(prev => ({ ...prev, ...updates }));
      return { error: null };
    } catch (err) {
      console.error('Error updating profile:', err);
      return { error: err instanceof Error ? err.message : 'Failed to update profile' };
    }
  };

  return { profile, loading, error, updateProfile };
};
