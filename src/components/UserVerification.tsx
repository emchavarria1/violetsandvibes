import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Camera, Shield, CheckCircle, Clock, Lock, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getVerificationState, type VerificationStatus } from '@/lib/verification';
import { useToast } from '@/hooks/use-toast';
import { isAdminBypassUser, resolveSubscriptionTier } from '@/lib/subscriptionTier';
import { useI18n } from '@/lib/i18n';

const VERIFICATION_MEDIA_BUCKET =
  import.meta.env.VITE_VERIFICATION_MEDIA_BUCKET || 'verification-media';
const MAX_VERIFICATION_FILE_BYTES = 10 * 1024 * 1024;

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
type ProfileThemeId = 'prism' | 'sunset' | 'midnight' | 'aurora';

type LikeReceivedItem = {
  likeId: string;
  likerId: string;
  name: string;
  photo: string | null;
  createdAt: string;
};

const PROFILE_THEME_OPTIONS: Array<{ id: ProfileThemeId; label: string; swatchClass: string }> = [
  { id: 'prism', label: 'Prism Glow', swatchClass: 'from-pink-500 via-purple-500 to-indigo-500' },
  { id: 'sunset', label: 'Sunset Bloom', swatchClass: 'from-rose-500 via-orange-400 to-amber-300' },
  { id: 'midnight', label: 'Midnight Aura', swatchClass: 'from-slate-800 via-indigo-900 to-purple-800' },
  { id: 'aurora', label: 'Aurora Wave', swatchClass: 'from-cyan-400 via-emerald-400 to-violet-500' },
];

const UserVerification: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();

  const [photoStatus, setPhotoStatus] = useState<VerificationStatus>('pending');
  const [idStatus, setIdStatus] = useState<VerificationStatus>('pending');
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [existingSafetySettings, setExistingSafetySettings] = useState<Record<string, any>>({});
  const [existingPrivacySettings, setExistingPrivacySettings] = useState<Record<string, any>>({});
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isAdminBypass, setIsAdminBypass] = useState(false);
  const [profileTheme, setProfileTheme] = useState<ProfileThemeId>('prism');
  const [visibilityBoostUntil, setVisibilityBoostUntil] = useState<string | null>(null);
  const [premiumActionLoading, setPremiumActionLoading] = useState(false);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesError, setLikesError] = useState<string | null>(null);
  const [likesReceived, setLikesReceived] = useState<LikeReceivedItem[]>([]);
  const [showLikesSection, setShowLikesSection] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const subscriptionTier = useMemo(
    () => resolveSubscriptionTier(existingPrivacySettings, existingSafetySettings),
    [existingPrivacySettings, existingSafetySettings]
  );
  const hasVioletsVerifiedAccess =
    isAdminBypass ||
    subscriptionTier === 'premium' ||
    subscriptionTier === 'elite';

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      if (!user?.id) {
        setIsAdminBypass(false);
        setLoadingState(false);
        return;
      }

      try {
        setLoadingState(true);
        const [{ data, error }, adminBypass] = await Promise.all([
          supabase
            .from('profiles')
            .select('safety_settings, privacy_settings')
            .eq('id', user.id)
            .maybeSingle(),
          isAdminBypassUser(user.id),
        ]);

        if (error) throw error;
        if (cancelled) return;

        const safety =
          data?.safety_settings && typeof data.safety_settings === 'object'
            ? (data.safety_settings as Record<string, any>)
            : {};
        const privacy =
          data?.privacy_settings && typeof data.privacy_settings === 'object'
            ? (data.privacy_settings as Record<string, any>)
            : {};
        const violetsVerified =
          privacy.violets_verified && typeof privacy.violets_verified === 'object'
            ? (privacy.violets_verified as Record<string, any>)
            : {};
        const nextTheme =
          typeof violetsVerified.profile_theme === 'string' &&
          PROFILE_THEME_OPTIONS.some((opt) => opt.id === violetsVerified.profile_theme)
            ? (violetsVerified.profile_theme as ProfileThemeId)
            : 'prism';

        const state = getVerificationState(safety);
        setExistingSafetySettings(safety);
        setExistingPrivacySettings(privacy);
        setIsAdminBypass(adminBypass);
        setPhotoStatus(state.photoStatus);
        setIdStatus(state.idStatus);
        setProfileTheme(nextTheme);
        setVisibilityBoostUntil(
          typeof violetsVerified.visibility_boost_until === 'string'
            ? violetsVerified.visibility_boost_until
            : null
        );
      } catch (error) {
        console.error('Failed to load verification state:', error);
        if (!cancelled) {
          setPhotoStatus('pending');
          setIdStatus('pending');
          setIsAdminBypass(false);
          setExistingPrivacySettings({});
          setProfileTheme('prism');
          setVisibilityBoostUntil(null);
        }
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    };

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const stopCameraStream = () => {
    if (!cameraStreamRef.current) return;
    cameraStreamRef.current.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraReady(false);
  };

  useEffect(() => {
    if (!showCameraCapture || !videoRef.current || !cameraStreamRef.current) return;

    const video = videoRef.current;
    video.srcObject = cameraStreamRef.current;

    const markReady = () => setCameraReady(true);
    video.addEventListener('loadedmetadata', markReady);
    void video.play().catch(() => {
      // no-op: browser autoplay restrictions handled by controls/actions.
    });

    return () => {
      video.removeEventListener('loadedmetadata', markReady);
      video.srcObject = null;
    };
  }, [showCameraCapture]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const verificationState = useMemo(
    () =>
      getVerificationState({
        ...existingSafetySettings,
        verification_photo_status: photoStatus,
        verification_id_status: idStatus,
      }),
    [existingSafetySettings, photoStatus, idStatus]
  );

  const updateVerificationStatus = async (
    type: 'photo' | 'id',
    nextStatus: VerificationStatus,
    fileName?: string,
    storagePath?: string
  ) => {
    if (!user?.id) return;

    const now = new Date().toISOString();
    const nextSafety = {
      ...existingSafetySettings,
      verification_photo_status: type === 'photo' ? nextStatus : photoStatus,
      verification_id_status: type === 'id' ? nextStatus : idStatus,
      ...(type === 'photo'
        ? { verification_photo_file_name: fileName || existingSafetySettings.verification_photo_file_name }
        : { verification_id_file_name: fileName || existingSafetySettings.verification_id_file_name }),
      ...(type === 'photo'
        ? {
            verification_photo_storage_path:
              storagePath || existingSafetySettings.verification_photo_storage_path,
          }
        : {
            verification_id_storage_path:
              storagePath || existingSafetySettings.verification_id_storage_path,
          }),
      ...(type === 'photo'
        ? { verification_photo_updated_at: now }
        : { verification_id_updated_at: now }),
    };

    const computed = getVerificationState(nextSafety);
    nextSafety.verification_submitted_at =
      computed.submittedForReview && !existingSafetySettings.verification_submitted_at
        ? now
        : existingSafetySettings.verification_submitted_at;
    nextSafety.verification_under_review = computed.underReview;
    // Explicit approved flag should only be true after full approval workflow.
    nextSafety.photoVerification = computed.fullyApproved;

    const { data: updatedRow, error } = await supabase
      .from('profiles')
      .update({
        safety_settings: nextSafety,
        updated_at: now,
      })
      .eq('id', user.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!updatedRow) {
      throw new Error('Profile record not found. Please complete your profile first.');
    }

    setExistingSafetySettings(nextSafety);
    if (type === 'photo') setPhotoStatus(nextStatus);
    if (type === 'id') setIdStatus(nextStatus);
  };

  const persistVioletsVerifiedSettings = async (patch: Record<string, any>) => {
    if (!user?.id) throw new Error('You must be logged in.');

    const now = new Date().toISOString();
    const existingVioletsVerified =
      existingPrivacySettings.violets_verified &&
      typeof existingPrivacySettings.violets_verified === 'object'
        ? (existingPrivacySettings.violets_verified as Record<string, any>)
        : {};

    const nextPrivacy = {
      ...existingPrivacySettings,
      violets_verified: {
        ...existingVioletsVerified,
        ...patch,
      },
    };

    const { data: updatedRow, error } = await supabase
      .from('profiles')
      .update({
        privacy_settings: nextPrivacy,
        updated_at: now,
      })
      .eq('id', user.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!updatedRow) throw new Error('Profile record not found.');
    setExistingPrivacySettings(nextPrivacy);
  };

  const applyProfileTheme = async (themeId: ProfileThemeId) => {
    if (!hasVioletsVerifiedAccess) return;
    try {
      setPremiumActionLoading(true);
      await persistVioletsVerifiedSettings({ profile_theme: themeId });
      setProfileTheme(themeId);
      toast({
        title: t('themeUpdated'),
        description: t('themePreferenceSaved'),
      });
    } catch (error) {
      console.error('Failed to apply profile theme:', error);
      toast({
        title: t('couldNotSaveTheme'),
        description: (error as Error)?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPremiumActionLoading(false);
    }
  };

  const activateVisibilityBoost = async () => {
    if (!hasVioletsVerifiedAccess) return;
    try {
      setPremiumActionLoading(true);
      const nowMs = Date.now();
      const currentUntilMs = visibilityBoostUntil ? new Date(visibilityBoostUntil).getTime() : 0;
      const baseMs = Number.isFinite(currentUntilMs) && currentUntilMs > nowMs ? currentUntilMs : nowMs;
      const nextUntil = new Date(baseMs + 24 * 60 * 60 * 1000).toISOString();

      await persistVioletsVerifiedSettings({ visibility_boost_until: nextUntil });
      setVisibilityBoostUntil(nextUntil);

      toast({
        title: t('visibilityBoostEnabled'),
        description: t('visibilityBoostActiveDescription'),
      });
    } catch (error) {
      console.error('Failed to activate visibility boost:', error);
      toast({
        title: t('couldNotActivateBoost'),
        description: (error as Error)?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPremiumActionLoading(false);
    }
  };

  const loadLikesReceived = async () => {
    if (!user?.id) return;

    try {
      setLikesLoading(true);
      setLikesError(null);

      const { data: likeRows, error: likesLookupError } = await supabase
        .from('likes')
        .select('id, liker_id, created_at')
        .eq('liked_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40);

      if (likesLookupError) throw likesLookupError;

      const likes = (likeRows ?? []) as Array<{
        id: string;
        liker_id: string;
        created_at: string;
      }>;

      const likerIds = Array.from(new Set(likes.map((row) => row.liker_id)));
      let profilesById = new Map<string, { name: string; photo: string | null }>();

      if (likerIds.length > 0) {
        const { data: profileRows, error: profileLookupError } = await supabase
          .from('profiles')
          .select('id, full_name, username, photos')
          .in('id', likerIds);

        if (profileLookupError) throw profileLookupError;

        profilesById = new Map(
          (profileRows ?? []).map((row: any) => [
            row.id,
            {
              name: row.full_name || row.username || 'Member',
              photo: Array.isArray(row.photos) ? row.photos[0] ?? null : null,
            },
          ])
        );
      }

      const mapped: LikeReceivedItem[] = likes.map((row) => {
        const profile = profilesById.get(row.liker_id);
        return {
          likeId: row.id,
          likerId: row.liker_id,
          createdAt: row.created_at,
          name: profile?.name || 'Member',
          photo: profile?.photo || null,
        };
      });

      setLikesReceived(mapped);
      setShowLikesSection(true);
    } catch (error) {
      console.error('Failed to load likes received:', error);
      setLikesError((error as Error)?.message || 'Could not load likes right now.');
    } finally {
      setLikesLoading(false);
    }
  };

  const pickSingleFile = (accept: string, captureMode?: 'user' | 'environment') =>
    new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      if (captureMode) {
        input.setAttribute('capture', captureMode);
      }
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0] ?? null;
        resolve(file);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });

  const startCameraCapture = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      stopCameraStream();
      cameraStreamRef.current = stream;
      setShowCameraCapture(true);
      return true;
    } catch (error) {
      console.warn('Camera access failed, falling back to file picker:', error);
      return false;
    }
  };

  const capturePhotoFile = async () => {
    const video = videoRef.current;
    if (!video) throw new Error('Camera is not ready yet.');

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not access capture context.');

    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });

    if (!blob) throw new Error('Could not capture photo.');

    return new File([blob], `verification-photo-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
  };

  const closeCameraCapture = () => {
    setShowCameraCapture(false);
    stopCameraStream();
  };

  const submitCapturedPhoto = async () => {
    try {
      setLoading(true);
      const file = await capturePhotoFile();
      const uploaded = await uploadVerificationFile('photo', file);
      await updateVerificationStatus(
        'photo',
        'submitted',
        uploaded.originalFileName,
        uploaded.path
      );

      toast({
        title: t('photoSubmitted'),
        description: t('verificationReviewTiming'),
      });
      closeCameraCapture();
    } catch (error) {
      console.error('Camera photo submit failed:', error);
      toast({
        title: t('error'),
        description: (error as Error)?.message || 'Could not submit verification photo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadVerificationFile = async (type: 'photo' | 'id', file: File) => {
    if (!user?.id) throw new Error('You must be logged in.');

    if (file.size > MAX_VERIFICATION_FILE_BYTES) {
      throw new Error('File is too large. Max size is 10MB.');
    }

    if (type === 'photo' && !file.type.startsWith('image/')) {
      throw new Error('Verification photo must be an image.');
    }

    if (
      type === 'id' &&
      !file.type.startsWith('image/') &&
      file.type !== 'application/pdf'
    ) {
      throw new Error('ID must be an image or PDF.');
    }

    const safeName = sanitizeFileName(file.name);
    const uniquePart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `${user.id}/${type}/${uniquePart}-${safeName}`;

    const { error } = await supabase.storage
      .from(VERIFICATION_MEDIA_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      const message = (error.message || '').toLowerCase();
      if (message.includes('bucket not found')) {
        throw new Error(
          `Verification storage bucket "${VERIFICATION_MEDIA_BUCKET}" was not found. Run migration 20260225_add_verification_media_storage.sql.`
        );
      }
      if (message.includes('row-level security')) {
        throw new Error(
          `Verification upload blocked by storage policy for bucket "${VERIFICATION_MEDIA_BUCKET}".`
        );
      }
      throw error;
    }

    return { path, originalFileName: file.name };
  };

  const handlePhotoUpload = async () => {
    try {
      const openedCamera = await startCameraCapture();
      if (openedCamera) return;

      setLoading(true);
      const file = await pickSingleFile('image/*', 'environment');
      if (!file) return;

      const uploaded = await uploadVerificationFile('photo', file);
      await updateVerificationStatus(
        'photo',
        'submitted',
        uploaded.originalFileName,
        uploaded.path
      );
      toast({
        title: t('photoSubmitted'),
        description: t('verificationReviewTiming'),
      });
    } catch (error) {
      console.error('Photo upload failed:', error);
      toast({
        title: t('error'),
        description: (error as Error)?.message || 'Could not submit verification photo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIdUpload = async () => {
    try {
      setLoading(true);
      const file = await pickSingleFile('image/*,.pdf');
      if (!file) return;

      const uploaded = await uploadVerificationFile('id', file);
      await updateVerificationStatus('id', 'submitted', uploaded.originalFileName, uploaded.path);
      toast({
        title: t('idSubmitted'),
        description: t('verificationReviewTiming'),
      });
    } catch (error) {
      console.error('ID upload failed:', error);
      toast({
        title: t('error'),
        description: (error as Error)?.message || 'Could not submit ID document.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const verificationSteps = [
    {
      id: 'photo',
      title: t('photoVerification'),
      completed: photoStatus === 'submitted' || photoStatus === 'approved',
    },
    {
      id: 'id',
      title: t('idVerification'),
      completed: idStatus === 'submitted' || idStatus === 'approved',
    },
    { id: 'review', title: t('reviewStep'), completed: verificationState.submittedForReview }
  ];

  const getStepBadge = (type: 'photo' | 'id') => {
    const status = type === 'photo' ? photoStatus : idStatus;
    if (status === 'approved') return <Badge variant="secondary" className="bg-green-100 text-green-700">{t('approved')}</Badge>;
    if (status === 'submitted') return <Badge variant="secondary" className="bg-purple-100 text-purple-700">{t('submitted')}</Badge>;
    if (status === 'rejected') return <Badge variant="secondary" className="bg-red-100 text-red-700">{t('rejected')}</Badge>;
    return null;
  };
  const visibilityBoostActive =
    !!visibilityBoostUntil && new Date(visibilityBoostUntil).getTime() > Date.now();
  const activeTheme = PROFILE_THEME_OPTIONS.find((option) => option.id === profileTheme);

  if (loadingState) {
    return (
      <div className="p-4 space-y-6 max-w-md mx-auto">
        <Card className="border-2 border-purple-200">
          <CardContent className="p-6 text-center text-gray-700">
            {t('verificationStatusChecking')}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto">
      <Card className="border-2 border-purple-200">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-xl text-purple-800">🌈💜 {t('getVerified')} 💜🌈</CardTitle>
          <p className="text-sm text-gray-600">{t('buildTrustInTheCommunity')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {verificationSteps.map((step) => (
            <div key={step.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                {step.completed ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-400" />
                )}
                <span className={step.completed ? 'text-green-700' : 'text-gray-700'}>
                  {step.title}
                </span>
              </div>
              {step.id === 'photo'
                ? getStepBadge('photo')
                : step.id === 'id'
                ? getStepBadge('id')
                : step.completed
                ? <Badge variant="secondary" className="bg-purple-100 text-purple-700">{t('inReview')}</Badge>
                : null}
            </div>
          ))}
          
          {showCameraCapture && (
            <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-3 space-y-3">
              <div className="text-sm text-purple-700 font-medium">{t('cameraPreview')}</div>
              <div className="overflow-hidden rounded-md border border-purple-200 bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-56 object-cover"
                  playsInline
                  muted
                  autoPlay
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={closeCameraCapture}
                  disabled={loading}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-pink-600 hover:bg-pink-700"
                  onClick={() => void submitCapturedPhoto()}
                  disabled={!cameraReady || loading}
                >
                  {loading ? `${t('submitting').replace('...', '')}...` : t('useThisPhoto')}
                </Button>
              </div>
              <div className="text-xs text-purple-700/80">
                {t('cameraAccessInstructions')}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-4">
            <Button 
              onClick={handlePhotoUpload}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              disabled={
                photoStatus === 'submitted' ||
                photoStatus === 'approved' ||
                loading ||
                showCameraCapture
              }
            >
              <Camera className="w-4 h-4 mr-2" />
              {photoStatus === 'approved'
                ? `${t('photoVerified')} ✓`
                : photoStatus === 'submitted'
                ? `${t('photoSubmitted')} ✓`
                : t('takeVerificationPhoto')}
            </Button>
            
            <Button 
              onClick={handleIdUpload}
              variant="outline"
              className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
              disabled={idStatus === 'submitted' || idStatus === 'approved' || loading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {idStatus === 'approved'
                ? `${t('idVerified')} ✓`
                : idStatus === 'submitted'
                ? `${t('idSubmitted')} ✓`
                : t('uploadIdDocument')}
            </Button>
          </div>

          {verificationState.submittedForReview && (
            <div className="mt-4 p-4 bg-purple-50 rounded-lg text-center">
              <p className="text-purple-700 font-medium">{t('verificationSubmitted')}</p>
              <p className="text-sm text-purple-600 mt-1">{t('verificationReviewTiming')}</p>
            </div>
          )}

          {verificationState.completeForAccess && (
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                const redirect = params.get('redirect');
                const target = redirect && redirect.startsWith('/') ? redirect : '/social';
                navigate(target, { replace: true });
              }}
            >
              {t('continueAction')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-dashed border-purple-300 bg-white/90">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg text-purple-800">💜 {t('violetsVerified')}</CardTitle>
          <p className="text-sm text-purple-700">{t('strengthenProtectedSpace')}</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {hasVioletsVerifiedAccess ? (
            <div className="rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm px-3 py-2 text-center">
              {t('accessEnabledForUpgradedAccount')}
            </div>
          ) : (
            <div className="rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-sm px-3 py-2 text-center">
              {t('upgradedMembersOnlyLocked')}
            </div>
          )}

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start border-purple-300 text-purple-800"
              disabled={!hasVioletsVerifiedAccess}
              onClick={() => navigate('/filters')}
            >
              {t('advancedFilters')}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-start border-purple-300 text-purple-800"
              disabled={!hasVioletsVerifiedAccess || likesLoading}
              onClick={() => void loadLikesReceived()}
            >
              {likesLoading ? t('loadingLikes') : t('seeWhoLikedYou')}
            </Button>
          </div>

          <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-3 space-y-2">
            <div className="text-sm font-medium text-purple-800">{t('customProfileThemes')}</div>
            <div className="grid grid-cols-2 gap-2">
              {PROFILE_THEME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={!hasVioletsVerifiedAccess || premiumActionLoading}
                  className={`rounded-md border px-2 py-2 text-left text-xs ${
                    option.id === profileTheme
                      ? 'border-purple-500 bg-purple-100 text-purple-900'
                      : 'border-purple-200 bg-white text-purple-700'
                  } disabled:opacity-50`}
                  onClick={() => void applyProfileTheme(option.id)}
                >
                  <div className={`mb-1 h-2 w-full rounded-full bg-gradient-to-r ${option.swatchClass}`} />
                  {option.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-purple-700/80">
              {t('activeTheme', { theme: activeTheme?.label || 'Prism Glow' })}
            </div>
          </div>

          <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-3 space-y-2">
            <div className="text-sm font-medium text-purple-800">{t('extraVisibilityPerks')}</div>
            <div className="text-xs text-purple-700">
              {visibilityBoostActive
                ? t('boostActiveUntil', { date: new Date(visibilityBoostUntil as string).toLocaleString() })
                : t('noActiveBoost')}
            </div>
            <Button
              type="button"
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={!hasVioletsVerifiedAccess || premiumActionLoading}
              onClick={() => void activateVisibilityBoost()}
            >
              {premiumActionLoading ? `${t('saving')}...` : t('activateVisibilityBoost')}
            </Button>
          </div>

          {showLikesSection ? (
            <div className="rounded-lg border border-purple-200 bg-white p-3">
              <div className="text-sm font-medium text-purple-800 mb-2">{t('peopleWhoLikedYou')}</div>
              {likesError ? (
                <div className="text-xs text-red-600">{likesError}</div>
              ) : likesReceived.length === 0 ? (
                <div className="text-xs text-purple-700">{t('noLikesYet')}</div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-auto pr-1">
                  {likesReceived.map((item) => (
                    <div key={item.likeId} className="flex items-center justify-between gap-2 rounded-md bg-purple-50 px-2 py-2">
                      <div className="min-w-0">
                        <div className="text-sm text-purple-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-purple-700/80">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => navigate(`/profile/${item.likerId}`)}
                      >
                        {t('view')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {!hasVioletsVerifiedAccess ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => navigate('/subscription')}
            >
              {t('upgradeToUnlock')}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserVerification;
