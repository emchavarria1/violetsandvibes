import React from 'react';
import { Camera } from 'lucide-react';
import { MultiPhotoUpload } from './MultiPhotoUpload';
import { useI18n } from '@/lib/i18n';

interface PhotosStepProps {
  profile: any;
  onUpdate: (updates: any) => void;
}

const PhotosStep: React.FC<PhotosStepProps> = ({ profile, onUpdate }) => {
  const { t } = useI18n();
  const handlePhotosChange = (photos: string[]) => {
    onUpdate({ photos });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">{t('profilePhotos')}</h2>
        <p className="text-white/70">{t('addPhotosShowPersonality')}</p>
      </div>

      <MultiPhotoUpload
        photos={profile.photos || []}
        onPhotosChange={handlePhotosChange}
        maxPhotos={6}
      />

      <div className="bg-blue-50 p-4 rounded-lg text-slate-700">
        <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
          <Camera className="w-4 h-4" />
          {t('photoGuidelines')}
        </h3>
        <ul className="text-sm space-y-1">
          <li>• {t('firstPhotoMainProfilePicture')}</li>
          <li>• {t('clearFacePhotosMatches')}</li>
          <li>• {t('showPersonalityAndInterests')}</li>
          <li>• {t('noInappropriateContent')}</li>
          <li>• {t('photosUploadedAndSaved')}</li>
        </ul>
      </div>
    </div>
  );
};

export { PhotosStep };
export default PhotosStep;
