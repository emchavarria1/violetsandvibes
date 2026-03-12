import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface PrivacyStepProps {
  profile: any;
  onUpdate: (updates: any) => void;
}

const PrivacyStep: React.FC<PrivacyStepProps> = ({ profile, onUpdate }) => {
  const { t } = useI18n();
  const updatePrivacySetting = (key: string, value: any) => {
    onUpdate({
      privacy: {
        ...profile.privacy,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">{t('privacyAndSafetySettings')}</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span className="font-medium">{t('profileVisibility')}</span>
          </div>
          <Select 
            value={profile.privacy?.profileVisibility || 'public'}
            onValueChange={(value) => updatePrivacySetting('profileVisibility', value)}
          >
            <SelectTrigger className="w-32 bg-white text-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">{t('publicLabel')}</SelectItem>
              <SelectItem value="private">{t('privateLabel')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <span>{t('showLastActive')}</span>
          <Switch
            checked={profile.privacy?.showLastActive ?? true}
            onCheckedChange={(checked) => updatePrivacySetting('showLastActive', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <span>{t('showDistance')}</span>
          <Switch
            checked={profile.privacy?.showDistance ?? true}
            onCheckedChange={(checked) => updatePrivacySetting('showDistance', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <span>{t('showAge')}</span>
          <Switch
            checked={profile.privacy?.showAge ?? true}
            onCheckedChange={(checked) => updatePrivacySetting('showAge', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <span>{t('allowMessagesFromStrangers')}</span>
          <Switch
            checked={profile.privacy?.allowMessagesFromStrangers ?? true}
            onCheckedChange={(checked) => updatePrivacySetting('allowMessagesFromStrangers', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <span>{t('photoVerificationRequired')}</span>
          <Switch
            checked={profile.privacy?.photoVerificationRequired ?? false}
            onCheckedChange={(checked) => updatePrivacySetting('photoVerificationRequired', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <span>{t('hideProfileFromSearch')}</span>
          <Switch
            checked={profile.privacy?.hideProfileFromSearch ?? false}
            onCheckedChange={(checked) => updatePrivacySetting('hideProfileFromSearch', checked)}
          />
        </div>
      </div>
    </div>
  );
};

export { PrivacyStep };
export default PrivacyStep;
