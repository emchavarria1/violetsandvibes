import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EnhancedProfileCreationFlow, {
  type EnhancedProfileCreationFlowHandle,
} from '@/components/EnhancedProfileCreationFlow';
import ProfileEditDropdown from '@/components/ProfileEditDropdown';
import ProfileEditBottomMenu from '@/components/ProfileEditBottomMenu';
import SubscriptionGate from '@/components/SubscriptionGate';
import { useToast } from '@/hooks/use-toast';
import { SubscriptionTier } from '@/types/subscription';
import { useAuth } from '@/hooks/useAuth';
import { loadEffectiveSubscriptionTierForUser } from '@/lib/subscriptionTier';
import { useI18n } from '@/lib/i18n';

const ProfileEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useI18n();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const flowRef = useRef<EnhancedProfileCreationFlowHandle | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTier = async () => {
      if (!user?.id) {
        setCurrentTier('free');
        return;
      }

      try {
        const tier = await loadEffectiveSubscriptionTierForUser(user.id);
        if (!cancelled) setCurrentTier(tier);
      } catch (error) {
        console.warn('Could not load subscription tier for Profile Edit:', error);
        if (!cancelled) setCurrentTier('free');
      }
    };

    void loadTier();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleComplete = async (profile: any) => {
    setIsLoading(true);
    try {
      console.log('Profile updated:', profile);
      toast({
        title: t('profileUpdated'),
        description: t('profileUpdatedSuccessfully'),
      });
      setHasUnsavedChanges(false);
      navigate('/profile');
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failedToSaveProfile'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (confirm(t('unsavedChangesLeaveConfirm'))) {
        navigate('/profile');
      }
    } else {
      navigate('/profile');
    }
  };

  const handleSave = async () => {
    if (!flowRef.current) return;

    setIsLoading(true);
    toast({
      title: t('savingProfile'),
      description: t('yourChangesAreBeingSaved'),
    });

    try {
      await flowRef.current.saveProfile();
      setHasUnsavedChanges(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = () => {
    setShowPreview(!showPreview);
    toast({
      title: showPreview ? t('editMode') : t('previewMode'),
      description: showPreview ? t('backToEditing') : t('viewingAsOthersSeeYou'),
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + '/profile');
    toast({
      title: t('profileLinkCopied'),
      description: t('shareYourProfileWithOthers'),
    });
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const handleUpgrade = (tier?: SubscriptionTier) => {
    navigate('/subscription');
  };

  const handleAddPhoto = () => {
    setShowPreview(false);
    flowRef.current?.goToStep(4);

    toast({
      title: t('photoUpload'),
      description: t('jumpedToPhotosStep'),
    });
  };

  const handleBoostProfile = () => {
    if (currentTier === 'free') {
      toast({
        title: t('upgradeRequired'),
        description: t('profileBoostUpgradeRequired'),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: t('profileBoosted'),
      description: t('profileShownToMorePeople'),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 pb-20">
      {/* Header with dropdown */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b p-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <h1 className="text-xl font-bold">{t('editProfile')}</h1>
          <ProfileEditDropdown
            onSave={handleSave}
            onPreview={handlePreview}
            onShare={handleShare}
            onSettings={handleSettings}
            onUpgrade={handleUpgrade}
            currentTier={currentTier}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="px-4">
        {currentTier === 'free' && (
          <div className="mb-4">
            <SubscriptionGate
              requiredTier="premium"
              currentTier={currentTier}
              featureName="Advanced Profile Features"
              onUpgrade={handleUpgrade}
            />
          </div>
        )}
        
        <EnhancedProfileCreationFlow
          ref={flowRef}
          onComplete={handleComplete} 
          onCancel={handleCancel}
          isPreview={showPreview}
          onDataChange={() => setHasUnsavedChanges(true)}
        />
      </div>

      {/* Bottom menu */}
      <ProfileEditBottomMenu
        onSave={handleSave}
        onCancel={handleCancel}
        onPreview={handlePreview}
        onAddPhoto={handleAddPhoto}
        onBoostProfile={handleBoostProfile}
        currentTier={currentTier}
        hasUnsavedChanges={hasUnsavedChanges}
        isLoading={isLoading}
      />
    </div>
  );
};

export default ProfileEditPage;
