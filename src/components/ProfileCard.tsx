import React from 'react';
import { MapPin, Sparkles, Star } from 'lucide-react';
import { PROFILE_VIBE_OPTIONS, type ProfileVibe } from '@/lib/vibes';

interface Profile {
  id: string;
  name: string;
  age?: number | null;
  bio: string;
  photos: string[];
  photoCropClass?: string;
  location?: string;
  interests?: string[];
  pronouns?: string;
  identity?: 'lesbian' | 'bisexual' | 'pansexual' | 'transgender' | 'rainbow';
}

interface ProfileCardProps {
  profile: Profile;
  onPass: () => void;
  onSendVibe: (vibe: ProfileVibe) => void;
  isSendingVibe?: boolean;
  style?: React.CSSProperties;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ 
  profile, 
  onPass,
  onSendVibe,
  isSendingVibe = false,
  style 
}) => {
  const identityClasses = {
    lesbian: 'lesbian-gradient',
    bisexual: 'bisexual-gradient',
    pansexual: 'pansexual-gradient',
    transgender: 'transgender-gradient',
    rainbow: 'rainbow-gradient'
  };

  const backgroundClass = profile.identity 
    ? identityClasses[profile.identity] 
    : 'bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600';

  return (
    <div 
      className="absolute inset-2 bg-black/90 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/20 hover:shadow-3xl hover:scale-105 transition-all duration-500 group min-h-[600px]"
      style={style}
    >
      {/* Animated Border Effect */}
      <div className="absolute inset-0 rounded-3xl">
        <div className={`absolute inset-0 rounded-3xl ${backgroundClass} opacity-20 blur-xl`} />
      </div>


      {/* Main Photo with Identity Gradient Overlay */}
      <div className={`relative h-3/5 ${backgroundClass} overflow-hidden`}>
        <img 
          src={profile.photos[0] || '/api/placeholder/400/600'} 
          alt={profile.name}
          className={`w-full h-full ${profile.photoCropClass || 'object-cover object-center'} opacity-100 transition-transform duration-300 group-hover:scale-[1.02]`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
        
        {/* Floating Star Effects */}
        <div className="absolute top-4 right-4 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
          <Star className="w-6 h-6 text-white animate-pulse" />
        </div>
        
        {/* Name and Age with Enhanced Typography */}
        <div className="absolute bottom-4 left-4 text-white">
          <h2 className="text-3xl font-bold mb-1 drop-shadow-lg hover:drop-shadow-2xl transition-all duration-300">
            {profile.name}
            {typeof profile.age === 'number' && profile.age > 0 ? `, ${profile.age}` : ''}
          </h2>
          {profile.location ? (
            <div className="flex items-center text-sm opacity-90 mb-2 hover:opacity-100 transition-opacity duration-300">
              <MapPin className="w-4 h-4 mr-1" />
              {profile.location}
            </div>
          ) : null}
          {profile.pronouns ? (
            <div className="text-sm glass-pride px-3 py-1 rounded-full inline-block hover:scale-110 transition-transform duration-300 border border-white/30">
              {profile.pronouns}
            </div>
          ) : null}
        </div>
      </div>

      {/* Profile Info with Enhanced Styling */}
      <div className="p-6 pb-64 h-2/5 overflow-y-auto bg-gradient-to-b from-transparent to-black/10">
        <p className="text-white/90 mb-4 leading-relaxed hover:text-white transition-colors duration-300">{profile.bio}</p>
        
        {/* Enhanced Interests with Staggered Animation */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(profile.interests ?? []).slice(0, 6).map((interest, index) => (
            <span 
              key={index}
              className="glass-pride text-white/90 px-3 py-1 rounded-full text-sm font-medium flex items-center border border-white/20 hover:border-white/40 hover:scale-105 transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Sparkles className="w-3 h-3 mr-1 animate-pulse" />
              {interest}
            </span>
          ))}
        </div>
      </div>

      {/* Send-a-vibe actions */}
      <div className="absolute inset-x-6 bottom-6 space-y-3">
        <button
          onClick={onPass}
          className="w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-sm font-medium text-white/80 transition-colors duration-300 hover:bg-black/50 hover:text-white"
        >
          Pass for now
        </button>

        <div className="rounded-3xl border border-white/12 bg-black/35 p-3 backdrop-blur-sm">
          <div className="mb-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
              Send a Vibe
            </div>
            <div className="mt-1 text-sm text-white/75">
              More human than a swipe. Lead with your energy.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PROFILE_VIBE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onSendVibe(option.value)}
                disabled={isSendingVibe}
                className={`rounded-2xl border px-3 py-3 text-left transition-all duration-300 disabled:opacity-60 ${option.buttonClass}`}
              >
                <div className="text-sm font-semibold">{option.label}</div>
                <div className="mt-1 text-xs text-white/70">{option.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;
