import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Heart, MapPin, Calendar } from 'lucide-react';
import { getProfilePhotoCropClass } from '@/lib/profiles';

interface Profile {
  id: string;
  username?: string;
  full_name: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  birthdate?: string;
  interests?: string[];
  identity?: 'lesbian' | 'bisexual' | 'pansexual' | 'transgender' | 'rainbow';
  pronouns?: string;
  lastActive?: string;
}

interface EnhancedProfileCardProps {
  profile: Profile;
  onLike?: (id: string) => void;
  onPass?: (id: string) => void;
  className?: string;
}

export const EnhancedProfileCard: React.FC<EnhancedProfileCardProps> = ({
  profile,
  onLike,
  onPass,
  className = ''
}) => {
  const photoCropClass = getProfilePhotoCropClass(profile);
  const calculateAge = (birthdate?: string) => {
    if (!birthdate) return null;
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(profile.birthdate);
  const identity = profile.identity || 'rainbow';
  
  const identityClasses = {
    lesbian: 'identity-lesbian',
    bisexual: 'identity-bisexual', 
    pansexual: 'identity-pansexual',
    transgender: 'identity-transgender',
    rainbow: 'identity-rainbow'
  };

  const identityBadgeColors = {
    lesbian: 'bg-orange-500/20 text-orange-700 border-orange-300',
    bisexual: 'bg-purple-500/20 text-purple-700 border-purple-300',
    pansexual: 'bg-pink-500/20 text-pink-700 border-pink-300',
    transgender: 'bg-blue-500/20 text-blue-700 border-blue-300',
    rainbow: 'bg-gradient-to-r from-red-500/20 to-purple-500/20 text-purple-700 border-purple-300'
  };

  return (
    <Card className={`card-pride-solid hover:scale-105 transition-all duration-300 overflow-hidden ${className}`}>
      <div className="relative">
        <div className={`h-2 w-full ${identityClasses[identity]}`} />
        
        {profile.avatar_url && (
          <div className="p-4">
            <img 
              src={profile.avatar_url} 
              alt={profile.full_name}
              className={`w-full h-48 rounded-lg ${photoCropClass}`}
            />
          </div>
        )}
        
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="wedding-title text-xl font-bold rainbow-header">
                {profile.full_name}{age ? `, ${age}` : ''}
              </h3>
              {profile.pronouns && (
                <p className="text-white/80 text-sm">{profile.pronouns}</p>
              )}
              {profile.location && (
                <div className="flex items-center text-white/70 text-sm mt-1">
                  <MapPin className="w-4 h-4 mr-1" />
                  {profile.location}
                </div>
              )}
            </div>
            
            <Badge className={`${identityBadgeColors[identity]} capitalize`}>
              {identity}
            </Badge>
          </div>

          {profile.bio && (
            <p className="text-white/90 text-sm mb-4 line-clamp-3">{profile.bio}</p>
          )}

          {profile.interests && profile.interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {profile.interests.slice(0, 3).map((interest) => (
                <Badge key={interest} variant="secondary" className="bg-black/25 text-white border-white/15">
                  {interest}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            {profile.lastActive && (
              <div className="flex items-center text-white/60 text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                Active {profile.lastActive}
              </div>
            )}
            
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => onPass?.(profile.id)}
                className="px-4 py-2 rounded-full bg-black/30 hover:bg-black/40 text-white transition-all duration-200 border border-white/12"
              >
                Pass
              </button>
              <button
                onClick={() => onLike?.(profile.id)}
                className="px-4 py-2 rounded-full btn-pride flex items-center gap-1"
              >
                <Heart className="w-4 h-4" />
                Like
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default EnhancedProfileCard;
