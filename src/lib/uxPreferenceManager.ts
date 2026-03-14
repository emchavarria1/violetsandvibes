import { SupabaseClient } from '@supabase/supabase-js';
import { invokeEdgeFunction } from '@/lib/supabase';

export interface UXPreferences {
  ux_preference: 'interactive_animated' | 'minimalist_simple' | 'default';
  color_scheme?: 'light' | 'dark' | 'system';
  animation_intensity?: number;
  reduce_motion?: boolean;
  high_contrast?: boolean;
  accent_color?: string;
}

export class UXPreferenceManager {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async setUXPreference(preferences: UXPreferences) {
    try {
      const { data, error } = await invokeEdgeFunction('update-ux-preferences', {
        body: JSON.stringify(preferences)
      });

      if (error) throw error;

      // Apply preferences immediately
      this.applyUXPreferences(preferences);
      return data;
    } catch (error) {
      console.error('Failed to update UX preferences:', error);
      throw error;
    }
  }

  applyUXPreferences(preferences: UXPreferences) {
    // Dynamic CSS/Style Application
    if (preferences.animation_intensity !== undefined) {
      document.documentElement.style.setProperty('--animation-intensity', preferences.animation_intensity.toString());
    }
    
    document.body.classList.toggle('high-contrast', preferences.high_contrast || false);
    
    // Reduce Motion Handling
    if (preferences.reduce_motion) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }

    // Color Scheme
    if (preferences.color_scheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (preferences.color_scheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (preferences.color_scheme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    }

    // Accent Color
    if (preferences.accent_color) {
      document.documentElement.style.setProperty('--accent-color', preferences.accent_color);
    }

    // UX Style Switching
    switch(preferences.ux_preference) {
      case 'interactive_animated':
        this.enableAnimatedInteractiveStyle();
        break;
      case 'minimalist_simple':
        this.enableMinimalistStyle();
        break;
      default:
        this.resetToDefaultStyle();
        break;
    }
  }

  private enableAnimatedInteractiveStyle() {
    // Add vibrant animations, transitions, interactive elements
    document.body.classList.add('interactive-animated');
    document.body.classList.remove('minimalist-simple');
  }

  private enableMinimalistStyle() {
    // Remove complex animations, focus on clarity and simplicity
    document.body.classList.add('minimalist-simple');
    document.body.classList.remove('interactive-animated');
  }

  private resetToDefaultStyle() {
    document.body.classList.remove('interactive-animated', 'minimalist-simple');
  }

  async loadUserPreferences() {
    try {
      const { data, error } = await this.supabase
        .from('ux_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        this.applyUXPreferences(data);
      }
      
      return data;
    } catch (error) {
      console.error('Failed to load UX preferences:', error);
      return null;
    }
  }
}
