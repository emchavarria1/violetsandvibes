import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Crown, 
  Settings, 
  Bell, 
  Shield, 
  Eye, 
  CreditCard,
  User,
  LogOut,
  ChevronRight,
  Smartphone,
  Globe,
  Heart,
  MessageCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SubscriptionTier } from '@/types/subscription';
import PaymentPreferences from '@/components/PaymentPreferences';
import SubscriptionManagement from '@/components/SubscriptionManagement';
import BillingHistory from '@/components/BillingHistory';
import PricingTiers from '@/components/PricingTiers';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/theme-provider';
import { applyAppPreferences, DEFAULT_APP_PREFERENCES, normalizeAppPreferences } from '@/lib/appPreferences';
import { useI18n } from '@/lib/i18n';
import {
  applyAdminBypassTier,
  isAdminBypassUser,
  resolveSubscriptionTier,
} from '@/lib/subscriptionTier';

const DEFAULT_SETTINGS = {
  notifications: {
    matches: true,
    messages: true,
    likes: false,
    events: true,
    marketing: false,
    pushNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
  },
  privacy: {
    showOnline: true,
    showDistance: true,
    showAge: true,
    profileDiscoverable: true,
    showReadReceipts: false,
    incognitoMode: false,
    hideFromSearch: false,
  },
  safety: {
    twoFactor: false,
    blockScreenshots: false,
    requireVerification: false,
    autoBlockSuspicious: true,
  },
  app: {
    ...DEFAULT_APP_PREFERENCES,
  },
  matching: {
    ageRange: [18, 35],
    maxDistance: 50,
    showMeOnPride: true,
    prioritizeVerified: false,
    hideAlreadySeen: true,
  },
} as const;

type SettingsState = {
  notifications: Record<keyof typeof DEFAULT_SETTINGS.notifications, boolean>;
  privacy: Record<keyof typeof DEFAULT_SETTINGS.privacy, boolean>;
  safety: Record<keyof typeof DEFAULT_SETTINGS.safety, boolean>;
  app: Record<keyof typeof DEFAULT_SETTINGS.app, boolean>;
  matching: {
    ageRange: [number, number];
    maxDistance: number;
    showMeOnPride: boolean;
    prioritizeVerified: boolean;
    hideAlreadySeen: boolean;
  };
};

const NOTIFICATION_GROUPS: Array<{
  title: string;
  items: Array<{
    key: keyof SettingsState['notifications'];
    label: string;
    description?: string;
  }>;
}> = [
  {
    title: 'Activity',
    items: [
      { key: 'matches', label: 'Matches' },
      { key: 'messages', label: 'Messages' },
      { key: 'likes', label: 'Likes' },
      { key: 'events', label: 'Events' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { key: 'pushNotifications', label: 'Push notifications' },
      { key: 'emailNotifications', label: 'Email notifications' },
      { key: 'smsNotifications', label: 'SMS notifications' },
      { key: 'marketing', label: 'Marketing', description: 'Promotions and updates' },
    ],
  },
];

const APP_PREFERENCE_ITEMS: Array<{ key: keyof SettingsState['app']; label: string }> = [
  { key: 'darkMode', label: 'Dark Mode' },
  { key: 'reducedMotion', label: 'Reduced Motion' },
  { key: 'highContrast', label: 'High Contrast' },
  { key: 'largeText', label: 'Large Text' },
  { key: 'autoPlayVideos', label: 'Auto Play Videos' },
  { key: 'soundEffects', label: 'Sound Effects' },
];

const PRIVACY_ITEMS: Array<{ key: keyof SettingsState['privacy']; label: string; description: string }> = [
  { key: 'showOnline', label: 'Show Online', description: 'Controls whether others can see you online in chat presence.' },
  { key: 'showDistance', label: 'Show Distance', description: 'Controls whether your location/distance is shown on discovery cards.' },
  { key: 'showAge', label: 'Show Age', description: 'Controls whether your age is shown on discovery cards.' },
  { key: 'profileDiscoverable', label: 'Profile Discoverable', description: 'If off, your profile is hidden from discovery.' },
  { key: 'showReadReceipts', label: 'Show Read Receipts', description: 'Saved setting for chat read receipt behavior.' },
  { key: 'incognitoMode', label: 'Incognito Mode', description: 'Hides your profile from discovery while enabled.' },
  { key: 'hideFromSearch', label: 'Hide From Search', description: 'Removes your profile from discovery/search lists.' },
];

const SAFETY_ITEMS: Array<{ key: keyof SettingsState['safety']; label: string; description: string }> = [
  { key: 'twoFactor', label: 'Two Factor', description: 'Saved security preference for account hardening.' },
  { key: 'blockScreenshots', label: 'Block Screenshots', description: 'Prevent screenshots of chats and profiles when supported by your device.' },
  { key: 'requireVerification', label: 'Require Verification', description: 'Only show photo-verified profiles in discovery.' },
  { key: 'autoBlockSuspicious', label: 'Auto Block Suspicious', description: 'Saved moderation preference for future enforcement hooks.' },
];

const createDefaultSettings = (): SettingsState => ({
  notifications: { ...DEFAULT_SETTINGS.notifications },
  privacy: { ...DEFAULT_SETTINGS.privacy },
  safety: { ...DEFAULT_SETTINGS.safety },
  app: { ...DEFAULT_SETTINGS.app },
  matching: { ...DEFAULT_SETTINGS.matching },
});

function mergeBooleanSettings<T extends Record<string, boolean>>(defaults: T, source: Record<string, any>) {
  const merged = { ...defaults };
  (Object.keys(defaults) as Array<keyof T>).forEach((key) => {
    const candidate = source?.[key as string];
    if (typeof candidate === 'boolean') merged[key] = candidate;
  });
  return merged;
}

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { setTheme } = useTheme();
  const { t } = useI18n();
  
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  
  const [settings, setSettings] = useState<SettingsState>(() => createDefaultSettings());
  const [loadingGeneral, setLoadingGeneral] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isHydrated, setIsHydrated] = useState(false);
  const persistTimerRef = useRef<number | null>(null);
  const basePrivacyRef = useRef<Record<string, any>>({});
  const baseSafetyRef = useRef<Record<string, any>>({});

  const handleUpgrade = () => {
    navigate('/subscription');
  };

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      if (!user?.id) {
        setSettings(createDefaultSettings());
        setCurrentTier('free');
        setLoadingGeneral(false);
        setIsHydrated(false);
        setSaveStatus('idle');
        return;
      }

      setLoadingGeneral(true);
      setSaveStatus('idle');

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('privacy_settings, safety_settings')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        const privacySettings = (data?.privacy_settings && typeof data.privacy_settings === 'object')
          ? (data.privacy_settings as Record<string, any>)
          : {};
        const safetySettings = (data?.safety_settings && typeof data.safety_settings === 'object')
          ? (data.safety_settings as Record<string, any>)
          : {};
        const resolvedTier = resolveSubscriptionTier(privacySettings, safetySettings);
        const isAdminBypass = await isAdminBypassUser(user.id);
        if (cancelled) return;

        basePrivacyRef.current = privacySettings;
        baseSafetyRef.current = safetySettings;
        setCurrentTier(applyAdminBypassTier(resolvedTier, isAdminBypass));

        const next = createDefaultSettings();
        next.notifications = mergeBooleanSettings(next.notifications, privacySettings.notifications || {});
        next.privacy = mergeBooleanSettings(next.privacy, privacySettings);
        next.safety = mergeBooleanSettings(next.safety, safetySettings);
        next.app = normalizeAppPreferences(privacySettings.app || {});
        next.matching = {
          ...next.matching,
          ...(privacySettings.matching || {}),
        };

        if (!Array.isArray(next.matching.ageRange) || next.matching.ageRange.length !== 2) {
          next.matching.ageRange = [...DEFAULT_SETTINGS.matching.ageRange] as [number, number];
        }
        if (typeof next.matching.maxDistance !== 'number') {
          next.matching.maxDistance = DEFAULT_SETTINGS.matching.maxDistance;
        }

        setSettings(next);
        setIsHydrated(true);
      } catch (err: any) {
        console.error('Failed to load settings:', err);
        if (!cancelled) {
          setSettings(createDefaultSettings());
          setCurrentTier('free');
          setIsHydrated(true);
          setSaveStatus('error');
          toast({
            title: 'Settings load issue',
            description: err?.message || 'Could not load saved settings.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoadingGeneral(false);
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [user?.id, toast]);

  useEffect(() => {
    if (!user?.id || !isHydrated || loadingGeneral) return;

    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);

    setSaveStatus('saving');
    persistTimerRef.current = window.setTimeout(async () => {
      try {
        const privacyPayload = {
          ...basePrivacyRef.current,
          ...settings.privacy,
          notifications: settings.notifications,
          app: settings.app,
          matching: settings.matching,
        };
        const safetyPayload = {
          ...baseSafetyRef.current,
          ...settings.safety,
        };

        const { data: updatedRow, error } = await supabase
          .from('profiles')
          .update({
            privacy_settings: privacyPayload,
            safety_settings: safetyPayload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (!updatedRow) throw new Error('Profile record not found');

        basePrivacyRef.current = privacyPayload;
        baseSafetyRef.current = safetyPayload;
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save settings:', err);
        setSaveStatus('error');
      }
    }, 450);

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [settings, user?.id, isHydrated, loadingGeneral]);

  useEffect(() => {
    if (!isHydrated) return;
    applyAppPreferences(settings.app, setTheme);
  }, [settings.app, setTheme, isHydrated]);

  const updateNotificationSetting = (key: keyof SettingsState['notifications'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value }
    }));
  };

  const updatePrivacySetting = (key: keyof SettingsState['privacy'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      privacy: { ...prev.privacy, [key]: value }
    }));
  };

  const updateSafetySetting = (key: keyof SettingsState['safety'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      safety: { ...prev.safety, [key]: value }
    }));
  };

  const updateAppSetting = (key: keyof SettingsState['app'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      app: { ...prev.app, [key]: value }
    }));
  };

  const updateMatchingSetting = (key: 'showMeOnPride' | 'prioritizeVerified' | 'hideAlreadySeen', value: boolean) => {
    setSettings(prev => ({
      ...prev,
      matching: { ...prev.matching, [key]: value }
    }));
  };

  const handleSignOut = async () => {
    if (confirm(`${t('signOut')}?`)) {
      await signOut();
      navigate('/signin');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id || deletingAccount) return;
    if (deleteConfirmText !== 'DELETE') {
      toast({
        title: 'Deletion cancelled',
        description: 'You must type DELETE exactly to continue.',
      });
      return;
    }

    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { confirm: true },
      });
      if (error) throw error;
      setDeleteDialogOpen(false);
      setDeleteConfirmText('');

      try {
        await signOut();
      } catch (signOutError) {
        console.warn('Sign-out after deletion returned an error:', signOutError);
      }

      toast({
        title: 'Account deleted',
        description: 'Your account has been permanently removed.',
      });
      navigate('/heroes', { replace: true });
    } catch (err: any) {
      console.error('Account deletion failed:', err);
      toast({
        title: 'Deletion failed',
        description: err?.message || 'Could not delete account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const formatSettingName = (key: string) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const notificationGroupTitle = (title: string) =>
    title === 'Activity' ? t('activity') : title === 'Communication' ? t('communication') : title;

  const notificationLabel = (label: string) => {
    switch (label) {
      case 'Matches': return t('matches');
      case 'Messages': return t('messages');
      case 'Likes': return t('likes');
      case 'Events': return t('events');
      case 'Push notifications': return t('pushNotifications');
      case 'Email notifications': return t('emailNotifications');
      case 'SMS notifications': return t('smsNotifications');
      case 'Marketing': return t('marketing');
      default: return label;
    }
  };

  const appPreferenceLabel = (label: string) => {
    switch (label) {
      case 'Dark Mode': return 'Dark Mode';
      case 'Reduced Motion': return 'Reduced Motion';
      case 'High Contrast': return 'High Contrast';
      case 'Large Text': return 'Large Text';
      case 'Auto Play Videos': return 'Auto Play Videos';
      case 'Sound Effects': return 'Sound Effects';
      default: return label;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('settingsPageTitle')}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {loadingGeneral
                ? t('loadingSettings')
                : saveStatus === 'saving'
                ? t('savingChanges')
                : saveStatus === 'saved'
                ? t('allChangesSaved')
                : saveStatus === 'error'
                ? t('saveIssueMayNotPersist')
                : t('changesSaveAutomatically')}
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            {t('done')}
          </Button>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">{t('general')}</TabsTrigger>
            <TabsTrigger value="privacy">{t('privacy')}</TabsTrigger>
            <TabsTrigger value="payments">{t('payments')}</TabsTrigger>
            <TabsTrigger value="account">{t('account')}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  {t('notifications')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {NOTIFICATION_GROUPS.map(({ title, items }) => (
                  <div key={title} className="space-y-4">
                    <div className="text-sm font-semibold tracking-wide text-gray-700 uppercase">
                      {notificationGroupTitle(title)}
                    </div>
                    <div className="space-y-4">
                      {items.map(({ key, label, description }) => (
                        <div key={key} className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <div>{notificationLabel(label)}</div>
                            {description ? (
                              <div className="text-xs text-gray-600">{description === 'Promotions and updates' ? t('promotionsAndUpdates') : description}</div>
                            ) : null}
                          </div>
                          <Switch 
                            checked={settings.notifications[key]}
                            onCheckedChange={(checked) => updateNotificationSetting(key, checked)}
                            disabled={loadingGeneral}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* App Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  {t('appPreferences')}
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {t('appPreferencesDescription')}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {APP_PREFERENCE_ITEMS.map(({ key, label }) => (
                  <div key={key} className="flex justify-between items-center">
                    <span>{appPreferenceLabel(label)}</span>
                    <Switch 
                      checked={settings.app[key]}
                      onCheckedChange={(checked) => updateAppSetting(key, checked)}
                      disabled={loadingGeneral}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Matching Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  {t('matchingPreferences')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(settings.matching).filter(([key]) => typeof settings.matching[key as keyof SettingsState['matching']] === 'boolean').map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span>{formatSettingName(key)}</span>
                    <Switch 
                      checked={Boolean(value)}
                      onCheckedChange={(checked) => updateMatchingSetting(key as 'showMeOnPride' | 'prioritizeVerified' | 'hideAlreadySeen', checked)}
                      disabled={loadingGeneral}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-6">
            {/* Privacy Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  {t('privacyControls')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {PRIVACY_ITEMS.map(({ key, label, description }) => (
                  <div key={key} className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div>{label}</div>
                      <div className="text-xs text-gray-600">{description}</div>
                    </div>
                    <Switch 
                      checked={settings.privacy[key]}
                      onCheckedChange={(checked) => updatePrivacySetting(key, checked)}
                      disabled={loadingGeneral}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Safety & Security */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  {t('safetySecurity')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {SAFETY_ITEMS.map(({ key, label, description }) => (
                  <div key={key} className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div>{label}</div>
                      <div className="text-xs text-gray-600">{description}</div>
                    </div>
                    <Switch 
                      checked={settings.safety[key]}
                      onCheckedChange={(checked) => updateSafetySetting(key, checked)}
                      disabled={loadingGeneral}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-700">
                  {t('verificationStatusManaged')}
                </div>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => navigate('/verification')}
                >
                  {t('openVerification')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            {/* Subscription Management */}
            <SubscriptionManagement 
              currentTier={currentTier}
              onUpgrade={handleUpgrade}
              onTierChange={(tier) => setCurrentTier(tier)}
            />

            {/* Billing History */}
            <BillingHistory />

            {/* Pricing Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>{t('availablePlans')}</CardTitle>
              </CardHeader>
              <CardContent>
                <PricingTiers 
                  currentTier={currentTier}
                  onTierSelect={(tier) => {
                    setCurrentTier(tier);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            {/* Account Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {t('accountManagement')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="ghost" 
                  className="w-full justify-between h-auto py-3 px-2" 
                  onClick={() => navigate('/edit-profile')}
                >
                  <div className="text-left">
                    <div>{t('editProfile')}</div>
                    <div className="text-xs text-gray-600">{t('editProfileDescription')}</div>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between h-auto py-3 px-2"
                  onClick={() => navigate('/verification')}
                >
                  <div className="text-left">
                    <div>{t('verification')}</div>
                    <div className="text-xs text-gray-600">{t('verificationDescription')}</div>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between h-auto py-3 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deletingAccount}
                >
                  <div className="text-left">
                    <div>{deletingAccount ? t('deletingAccount') : t('deleteAccount')}</div>
                    <div className="text-xs text-red-500/80">{t('deleteAccountDescription')}</div>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Sign Out */}
            <Card>
              <CardContent className="pt-6">
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('signOut')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (deletingAccount) return;
          setDeleteDialogOpen(open);
          if (!open) setDeleteConfirmText('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">{t('deleteAccountPermanently')}</DialogTitle>
            <DialogDescription>
              {t('deleteAccountDialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="delete-confirm-input" className="text-sm font-medium text-foreground">
              {t('typeToConfirm')} <span className="font-bold tracking-wide">DELETE</span> {t('toConfirm')}
            </label>
            <Input
              id="delete-confirm-input"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              disabled={deletingAccount}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText('');
              }}
              disabled={deletingAccount}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
            >
              {deletingAccount ? t('deletingAccount') : t('deleteAccount')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
