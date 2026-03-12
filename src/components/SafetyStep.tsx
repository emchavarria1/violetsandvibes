import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, AlertTriangle, Users, Lock } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface SafetyStepProps {
  profile: any;
  onUpdate: (updates: any) => void;
}

const SafetyStep: React.FC<SafetyStepProps> = ({ profile, onUpdate }) => {
  const { t } = useI18n();
  // Initialize safety settings when component loads
  React.useEffect(() => {
    if (!profile.safety || Object.keys(profile.safety).length === 0) {
      onUpdate({
        safety: {
          identityVerified: false,
          photoVerified: false,
          locationPrivacy: 'matches_only',
          maxDistance: 25,
          showExactLocation: false,
          communityGuidelinesAccepted: true
        }
      });
    }
  }, []);
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">{t('safetyDashboard')}</h2>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold">{t('verificationComplete')}</h3>
          </div>
          <p className="text-sm text-blue-700">{t('reportsFiled')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5" />
            <h3 className="font-semibold">{t('identityVerification')}</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>{t('uploadSelfieIdentityConfirmation')}</span>
              <span className="text-pink-600 font-medium">{t('requiredLabel')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('videoVerificationRealtime')}</span>
              <span className="text-pink-600 font-medium">{t('requiredLabel')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-5 h-5" />
            <h3 className="font-semibold">{t('locationPrivacy')}</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>{t('showExactLocation')}</span>
              <span className="text-gray-500">{t('offLabel')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('maximumSearchDistance')}</span>
              <span className="text-gray-500">{t('milesValue', { count: 25 })}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('locationVisibility')}</span>
              <span className="text-gray-500">{t('matchesOnly')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5" />
            <h3 className="font-semibold">{t('privacyProtection')}</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            {t('locationDataEncrypted')}
          </p>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold">{t('communityGuidelines')}</h3>
          </div>
          <ul className="text-sm space-y-1">
            <li>• {t('respectAllCommunityMembers')}</li>
            <li>• {t('noHarassmentOrDiscrimination')}</li>
            <li>• {t('useAuthenticPhotosAndInformation')}</li>
            <li>• {t('reportInappropriateBehavior')}</li>
            <li>• {t('protectYourPersonalInformation')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export { SafetyStep };
export default SafetyStep;
