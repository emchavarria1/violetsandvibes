import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/lib/i18n';

interface IdentityStepProps {
  profile: any;
  onUpdate: (updates: any) => void;
}

const IdentityStep: React.FC<IdentityStepProps> = ({ profile, onUpdate }) => {
  const { t } = useI18n();
  const genderOptions = ['Woman', 'Man', 'Non-binary', 'Genderfluid', 'Transgender', 'Questioning'];
  const orientationOptions = ['Lesbian', 'Gay', 'Bisexual', 'Pansexual', 'Queer', 'Questioning', 'Asexual'];
  const prideFlags = [
    { name: 'LGBTQ+', color: 'bg-gradient-to-r from-red-400 to-purple-400' },
    { name: 'Trans', color: 'bg-gradient-to-r from-blue-300 to-pink-300' },
    { name: 'Bisexual', color: 'bg-gradient-to-r from-pink-400 to-purple-600' },
    { name: 'Lesbian', color: 'bg-gradient-to-r from-orange-400 to-pink-500' },
    { name: 'Non-binary', color: 'bg-gradient-to-r from-yellow-300 to-purple-400' },
    { name: 'Pansexual', color: 'bg-gradient-to-r from-pink-400 to-yellow-300' },
    { name: 'Asexual', color: 'bg-gradient-to-r from-gray-700 to-purple-400' },
    { name: 'Genderfluid', color: 'bg-gradient-to-r from-pink-300 to-blue-300' }
  ];
  const selectedPridePins: string[] = Array.isArray(profile.pridePins) ? profile.pridePins : [];

  const togglePridePin = (pinName: string) => {
    const nextPins = selectedPridePins.includes(pinName)
      ? selectedPridePins.filter((name) => name !== pinName)
      : [...selectedPridePins, pinName];

    onUpdate({ pridePins: nextPins });
  };

  const genderLabelMap: Record<string, string> = {
    Woman: 'Woman',
    Man: 'Man',
    'Non-binary': 'Non-binary',
    Genderfluid: 'Genderfluid',
    Transgender: 'Transgender',
    Questioning: 'Questioning',
  };
  const orientationLabelMap: Record<string, string> = {
    Lesbian: 'Lesbian',
    Gay: 'Gay',
    Bisexual: 'Bisexual',
    Pansexual: 'Pansexual',
    Queer: 'Queer',
    Questioning: 'Questioning',
    Asexual: 'Asexual',
  };

  const addCustomGenderIdentity = () => {
    const value = window.prompt(t('enterCustomGenderIdentity'));
    const trimmed = value?.trim();
    if (!trimmed) return;
    onUpdate({ genderIdentity: trimmed });
  };

  const addCustomOrientation = () => {
    const value = window.prompt(t('enterCustomOrientation'));
    const trimmed = value?.trim();
    if (!trimmed) return;
    onUpdate({ sexualOrientation: trimmed });
  };

  const customGenderIdentity =
    profile.genderIdentity && !genderOptions.includes(profile.genderIdentity)
      ? profile.genderIdentity
      : null;

  const customOrientation =
    profile.sexualOrientation && !orientationOptions.includes(profile.sexualOrientation)
      ? profile.sexualOrientation
      : null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">{t('identityAndExpression')}</h2>
      </div>

      <div>
        <label className="block text-sm font-medium mb-3">{t('genderIdentityRequired')}</label>
        <div className="grid grid-cols-2 gap-2">
          {genderOptions.map((option) => (
            <Button
              key={option}
              variant={profile.genderIdentity === option ? "default" : "outline"}
              className="justify-start"
              onClick={() => onUpdate({ genderIdentity: option })}
            >
              {t(genderLabelMap[option] || option)}
            </Button>
          ))}
        </div>
        <Button variant="ghost" className="mt-2 text-sm" onClick={addCustomGenderIdentity} type="button">
          <Plus className="w-4 h-4 mr-1" />
          {t('addCustomIdentity')}
        </Button>
        {customGenderIdentity ? (
          <p className="text-xs text-white/70 mt-1">
            {t('selectedCustomIdentity', { value: customGenderIdentity })}
          </p>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-medium mb-3">{t('sexualOrientationRequired')}</label>
        <div className="grid grid-cols-2 gap-2">
          {orientationOptions.map((option) => (
            <Button
              key={option}
              variant={profile.sexualOrientation === option ? "default" : "outline"}
              className="justify-start"
              onClick={() => onUpdate({ sexualOrientation: option })}
            >
              {t(orientationLabelMap[option] || option)}
            </Button>
          ))}
        </div>
        <Button variant="ghost" className="mt-2 text-sm" onClick={addCustomOrientation} type="button">
          <Plus className="w-4 h-4 mr-1" />
          {t('addCustomOrientation')}
        </Button>
        {customOrientation ? (
          <p className="text-xs text-white/70 mt-1">
            {t('selectedCustomOrientation', { value: customOrientation })}
          </p>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-medium mb-3">{t('pronounsOptional')}</label>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="show-pronouns"
            checked={profile.showPronouns}
            onCheckedChange={(checked) => onUpdate({ showPronouns: checked })}
          />
          <label htmlFor="show-pronouns" className="text-sm">{t('showPronounsOnProfile')}</label>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">{t('pridePinsAndCommunityLabels')}</h3>
        <p className="text-sm text-white/70 mb-4">
          {t('pridePinsDescription')}
        </p>
        <p className="text-xs text-white/55 mb-4">
          {t('tapToSelectOrUnselect')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {prideFlags.map((flag) => (
            <Button
              key={flag.name}
              type="button"
              variant={selectedPridePins.includes(flag.name) ? "default" : "outline"}
              className="justify-start"
              onClick={() => togglePridePin(flag.name)}
            >
              <div className={`w-4 h-4 rounded mr-2 ${flag.color}`}></div>
              {flag.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export { IdentityStep };
export default IdentityStep;
