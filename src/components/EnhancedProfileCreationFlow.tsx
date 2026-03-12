import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLocation } from 'react-router-dom';
import BasicInfoStep from './BasicInfoStep';
import IdentityStep from './IdentityStep';
import PhotosStep from './PhotosStep';
import InterestsSelector from './InterestsSelector';
import LifestyleStep from './LifestyleStep';
import SafetyStep from './SafetyStep';
import PrivacyStep from './PrivacyStep';
import ProfileValidation from './ProfileValidation';
import { useI18n } from '@/lib/i18n';

interface EnhancedProfileCreationFlowProps {
  onComplete?: (profile: any) => void;
  onCancel?: () => void;
  isPreview?: boolean;
  onDataChange?: () => void;
}

export interface EnhancedProfileCreationFlowHandle {
  saveProfile: () => Promise<void>;
  goToStep: (stepIndex: number) => void;
}

function isMissingBirthdateColumnError(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? '';
  return message.includes("Could not find the 'birthdate' column") || message.includes('Could not find the "birthdate" column');
}

function isMissingFullNameColumnError(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? '';
  return message.includes("Could not find the 'full_name' column") || message.includes('Could not find the "full_name" column');
}

function persistedPhotoUrls(photos: string[] | undefined | null) {
  if (!Array.isArray(photos)) return [];
  return photos
    .map((p) => `${p ?? ''}`.trim())
    .filter((p) => !!p && !p.startsWith('blob:') && !p.startsWith('data:'));
}

function computeBirthdateISO(ageValue: unknown): string | null {
  const age = Number.parseInt(`${ageValue ?? ''}`, 10);
  if (!Number.isFinite(age) || age <= 0) return null;
  const birthdate = new Date();
  birthdate.setFullYear(birthdate.getFullYear() - age);
  return birthdate.toISOString().split('T')[0];
}

function toDbProfileData(profile: any, user: any, profileCompleted: boolean) {
  const lifestyleInterests = {
    ...(profile.lifestyle || {}),
    pride_pins: Array.isArray(profile.pridePins) ? profile.pridePins : [],
  };

  return {
    id: user.id,
    full_name: profile.name?.trim() || null,
    display_name: profile.name?.trim() || user.user_metadata?.name || user.email || 'Member',
    bio: profile.bio?.trim() || null,
    location: profile.location?.trim() || null,
    occupation: profile.occupation?.trim() || null,
    birthdate: computeBirthdateISO(profile.age),
    gender_identity: profile.genderIdentity?.trim() || null,
    sexual_orientation: profile.sexualOrientation?.trim() || null,
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    photos: persistedPhotoUrls(profile.photos),
    lifestyle_interests: lifestyleInterests,
    privacy_settings: profile.privacy || {},
    safety_settings: profile.safety || {},
    profile_completed: profileCompleted,
    updated_at: new Date().toISOString(),
  };
}

const EnhancedProfileCreationFlow = forwardRef<
  EnhancedProfileCreationFlowHandle,
  EnhancedProfileCreationFlowProps
>(({ 
  onComplete, 
  onCancel,
  isPreview = false,
  onDataChange
}, ref) => {
  const { user } = useAuth();
  const { profile: existingProfile, loading: profileLoading } = useProfile();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useI18n();
  // /edit-profile should behave as edit mode by default, even without navigation state.
  const isEditing = location.state?.isEditing ?? true;
  
  const [currentStep, setCurrentStep] = useState(0);
  const [profile, setProfile] = useState({
    name: '',
    age: '',
    location: '',
    occupation: '',
    bio: '',
    genderIdentity: '',
    sexualOrientation: '',
    showPronouns: false,
    pridePins: [],
    interests: [],
    photos: [],
    lifestyle: {},
    safety: {
      blockUsers: [],
      reportedUsers: [],
      safetyTips: true,
      photoVerification: false
    },
    privacy: {
      profileVisibility: 'public',
      showLastActive: true,
      showDistance: true,
      showAge: true,
      allowMessagesFromStrangers: true,
      photoVerificationRequired: false,
      hideProfileFromSearch: false
    }
  });
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);

  // Load existing profile data for editing
  useEffect(() => {
    if (isEditing && existingProfile && !profileLoading) {
      setProfile({
        name: existingProfile.full_name || '',
        age: existingProfile.age?.toString() || '',
        location: existingProfile.location || '',
        occupation: existingProfile.occupation || '',
        bio: existingProfile.bio || '',
        genderIdentity: existingProfile.gender_identity || '',
        sexualOrientation: existingProfile.sexual_orientation || '',
        showPronouns: false,
        pridePins: Array.isArray((existingProfile.lifestyle_interests as any)?.pride_pins)
          ? (existingProfile.lifestyle_interests as any).pride_pins
          : [],
        interests: existingProfile.interests || [],
        photos: existingProfile.photos || [],
        lifestyle: existingProfile.lifestyle_interests || {},
        safety: existingProfile.safety_settings || {
          blockUsers: [],
          reportedUsers: [],
          safetyTips: true,
          photoVerification: false
        },
        privacy: existingProfile.privacy_settings || {
          profileVisibility: 'public',
          showLastActive: true,
          showDistance: true,
          showAge: true,
          allowMessagesFromStrangers: true,
          photoVerificationRequired: false,
          hideProfileFromSearch: false
        }
      });
    }
  }, [isEditing, existingProfile, profileLoading]);

  const steps = [
    { title: t('basicInfo'), component: BasicInfoStep },
    { title: t('identity'), component: IdentityStep },
    { title: t('interestsLabel'), component: InterestsSelector },
    { title: t('lifestyle'), component: LifestyleStep },
    { title: t('photosLabel'), component: PhotosStep },
    { title: t('privacy'), component: PrivacyStep },
    { title: t('safety'), component: SafetyStep }
  ];

  const updateProfile = (updates: any) => {
    setProfile(prev => ({ ...prev, ...updates }));
    onDataChange?.();
    
    // Auto-save draft for editing mode
    if (isEditing) {
      autoSaveProfile(updates);
    }
  };

  const autoSaveProfile = async (updates: any) => {
    if (!user || autoSaving) return;
    
    setAutoSaving(true);
    try {
      const mergedProfile = {
        ...profile,
        ...updates,
        photos: persistedPhotoUrls((updates as any)?.photos ?? (profile as any).photos),
      };
      const profileData = toDbProfileData(mergedProfile, user, true);

      let { error } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (error && (isMissingBirthdateColumnError(error) || isMissingFullNameColumnError(error))) {
        const { birthdate: _birthdate, full_name: _full_name, ...fallbackProfileData } = profileData;
        const retry = await supabase
          .from('profiles')
          .upsert(fallbackProfileData);
        error = retry.error;
      }

      if (error) throw error;
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setAutoSaving(false);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!(profile.name && profile.age && profile.bio);
      case 1:
        return !!(profile.genderIdentity && profile.sexualOrientation);
      case 2:
        return profile.interests.length > 0;
      case 4:
        return persistedPhotoUrls((profile as any).photos).length > 0;
      default:
        return true;
    }
  };

  const persistProfile = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const profileData = toDbProfileData(profile, user, true);

      let { error } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (error && (isMissingBirthdateColumnError(error) || isMissingFullNameColumnError(error))) {
        const { birthdate: _birthdate, full_name: _full_name, ...fallbackProfileData } = profileData;
        const retry = await supabase
          .from('profiles')
          .upsert(fallbackProfileData);
        error = retry.error;
      }

      if (error) throw error;
      
      toast({
        title: t('save'),
        description: t('profileUpdatedSuccessfully'),
      });
      
      onComplete?.(profileData);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: t('error'),
        description: t('failedToSaveProfile'),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    saveProfile: async () => {
      await persistProfile();
    },
    goToStep: (stepIndex: number) => {
      const normalized = Number.isFinite(stepIndex) ? Math.floor(stepIndex) : 0;
      const clamped = Math.max(0, Math.min(normalized, steps.length - 1));
      setCurrentStep(clamped);
    },
  }));

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      void persistProfile();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p>{t('loadingProfile')}</p>
        </div>
      </div>
    );
  }

  const CurrentStepComponent = steps[currentStep].component;
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isValid = validateStep(currentStep);

  if (isPreview) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">{t('profilePreview')}</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{profile.name}, {profile.age}</h3>
                <p className="text-sm text-gray-600">{profile.location}</p>
                <p className="text-sm text-gray-600">{profile.occupation}</p>
              </div>
              <div>
                <p className="text-sm">{profile.bio}</p>
              </div>
              <div>
                <p className="text-sm font-medium">{t('interestsLabel')}:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.interests.map((interest, index) => (
                    <Badge key={index} variant="secondary">{interest}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <Badge variant="outline">{t('stepOf', { current: currentStep + 1, total: steps.length })}</Badge>
            <h1 className="text-lg font-semibold">
              {isEditing ? t('editStep', { step: steps[currentStep].title }) : steps[currentStep].title}
            </h1>
            {autoSaving && (
              <Badge variant="secondary" className="text-xs">
                <Save className="w-3 h-3 mr-1" />
                {t('autoSaving')}
              </Badge>
            )}
          </div>
          <Progress value={progress} className="mb-2" />
        </div>

        <ProfileValidation profile={profile} currentStep={currentStep} />
        
        {currentStep === 2 ? (
          <InterestsSelector
            selectedInterests={profile.interests}
            onSelectionChange={(interests) => updateProfile({ interests })}
          />
        ) : (
          <CurrentStepComponent profile={profile} onUpdate={updateProfile} />
        )}

        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={currentStep === 0 && onCancel ? onCancel : prevStep}
            disabled={saving}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {currentStep === 0 && onCancel ? t('cancel') : t('back')}
          </Button>
          
          <Button
            onClick={nextStep}
            disabled={!isValid || saving}
            className="bg-pink-500 hover:bg-pink-600"
          >
            {saving ? t('saving') : currentStep === steps.length - 1 ?
              (isEditing ? t('saveChanges') : t('completeProfile')) : t('continueAction')}
            {currentStep < steps.length - 1 && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
});

EnhancedProfileCreationFlow.displayName = 'EnhancedProfileCreationFlow';

export default EnhancedProfileCreationFlow;
