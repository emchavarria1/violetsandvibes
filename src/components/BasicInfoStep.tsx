import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Briefcase } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface BasicInfoStepProps {
  profile: any;
  onUpdate: (updates: any) => void;
}

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({ profile, onUpdate }) => {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">{t('basicInformation')}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">{t('nameRequired')}</label>
          <Input
            placeholder={t('yourName')}
            value={profile.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="bg-white text-black placeholder:text-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t('ageRequired')}</label>
          <Input
            placeholder={t('yourAge')}
            type="number"
            value={profile.age}
            onChange={(e) => onUpdate({ age: e.target.value })}
            className="bg-white text-black placeholder:text-gray-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {t('location')}
          </label>
          <Input
            placeholder={t('cityState')}
            value={profile.location}
            onChange={(e) => onUpdate({ location: e.target.value })}
            className="bg-white text-black placeholder:text-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            {t('occupation')}
          </label>
          <Input
            placeholder={t('yourJob')}
            value={profile.occupation}
            onChange={(e) => onUpdate({ occupation: e.target.value })}
            className="bg-white text-black placeholder:text-gray-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">{t('bioRequired')}</label>
        <Textarea
          placeholder={t('bioPrompt')}
          value={profile.bio}
          onChange={(e) => onUpdate({ bio: e.target.value })}
          rows={4}
          className="bg-white text-black placeholder:text-gray-500"
        />
      </div>
    </div>
  );
};

export { BasicInfoStep };
export default BasicInfoStep;
