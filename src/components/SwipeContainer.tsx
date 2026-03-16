import React, { useEffect, useState } from 'react';
import ProfileCard from './ProfileCard';
import { useSwipeLimit } from '@/hooks/useSwipeLimit';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { useAuth } from '@/hooks/useAuth';
import { fetchDiscoverProfiles, type ProfileRow } from '@/lib/profiles';
import { sendProfileVibe, type ProfileVibe } from '@/lib/vibes';
import { useToast } from '@/hooks/use-toast';

interface SwipeProfile {
  id: string;
  name: string;
  age?: number | null;
  bio: string;
  photos: string[];
  location: string;
  interests?: string[];
  pronouns?: string;
  identity?: 'lesbian' | 'bisexual' | 'pansexual' | 'transgender' | 'rainbow';
}

const calculateAge = (birthdate?: string | null) => {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};

const detectIdentity = (profile: ProfileRow): SwipeProfile['identity'] => {
  const identityText = [profile.gender_identity, ...(profile.interests || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (identityText.includes('lesbian')) return 'lesbian';
  if (identityText.includes('bisexual') || identityText.includes('bi ')) return 'bisexual';
  if (identityText.includes('pansexual') || identityText.includes('pan ')) return 'pansexual';
  if (identityText.includes('trans')) return 'transgender';
  return 'rainbow';
};

const mapToSwipeProfile = (profile: ProfileRow): SwipeProfile => ({
  id: profile.id,
  name: profile.full_name?.trim() || 'Member',
  age: calculateAge(profile.birthdate),
  bio: profile.bio?.trim() || 'Looking to meet kind, aligned people in community.',
  photos: profile.photos && profile.photos.length > 0 ? profile.photos : ['/api/placeholder/400/600'],
  location: profile.location?.trim() || '',
  interests: profile.interests || [],
  pronouns: profile.gender_identity || undefined,
  identity: detectIdentity(profile),
});

const SwipeContainer: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<SwipeProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingLike, setSubmittingLike] = useState(false);
  const { isLimitReached, remainingSwipes, incrementSwipe, isUnlimited } = useSwipeLimit();

  useEffect(() => {
    const run = async () => {
      if (!user?.id) {
        setProfiles([]);
        setCurrentIndex(0);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const rows = await fetchDiscoverProfiles(user.id, { includeLocalDemo: true });
        setProfiles(rows.map(mapToSwipeProfile));
        setCurrentIndex(0);
      } catch (loadError: any) {
        console.error('Failed to load swipe profiles:', loadError);
        setError(loadError?.message || 'Could not load profiles');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [user?.id]);

  const advance = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  const handlePass = () => {
    if (isLimitReached) return;
    if (!incrementSwipe()) return;

    advance();
  };

  const handleSendVibe = async (vibe: ProfileVibe) => {
    if (isLimitReached) return;
    if (!incrementSwipe()) return;

    const currentProfile = profiles[currentIndex];
    if (!user?.id || !currentProfile?.id) {
      advance();
      return;
    }

    setSubmittingLike(true);
    try {
      const result = await sendProfileVibe(user.id, currentProfile.id, vibe);

      toast({
        title: result.matched ? "It’s a match 💜" : `Sent a ${vibe} vibe`,
        description: result.matched
          ? `You and ${currentProfile.name} can message each other now.`
          : `${currentProfile.name} will see that you led with ${vibe} energy.`,
      });
    } catch (likeError: any) {
      console.error('Failed to send vibe during discovery:', likeError);
      toast({
        title: "Could not send vibe",
        description: likeError?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingLike(false);
      advance();
    }
  };

  const currentProfile = profiles[currentIndex];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center glass-pride-strong p-8 m-4 rounded-xl">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-white mb-2">Loading profiles...</h2>
          <p className="text-white/80">Getting people you have not seen yet.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center glass-pride-strong p-8 m-4 rounded-xl">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-2xl font-bold text-white mb-2">Could not load profiles</h2>
          <p className="text-white/80 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()} className="btn-pride">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Show limit reached message
  if (isLimitReached && !isUnlimited) {
    return (
      <div className="flex-1 flex items-center justify-center glass-pride-strong p-8 m-4 rounded-xl">
        <div className="text-center p-8 max-w-md">
          <div className="text-6xl mb-4">⏰</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Daily Discovery Limit Reached
          </h2>
          <p className="text-white/80 mb-6">
            You've used all 50 of your daily discovery actions. Upgrade to 💜 Violets Verified Plus for more room to connect.
          </p>
          <Button className="btn-pride">
            Upgrade to 💜 Violets Verified Plus
          </Button>
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="flex-1 flex items-center justify-center glass-pride-strong p-8 m-4 rounded-xl">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🌈</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            No more profiles!
          </h2>
          <p className="text-white/80">
            Check back later for more amazing people to connect with.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative p-2 min-h-[700px]">
      {/* Swipe counter */}
      {!isUnlimited && (
        <Card className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-3">
            <p className="text-sm font-medium">
              {remainingSwipes} discovery actions left today
            </p>
          </CardContent>
        </Card>
      )}
      
      <ProfileCard
        profile={currentProfile}
        onPass={submittingLike ? () => {} : handlePass}
        onSendVibe={submittingLike ? () => {} : ((vibe) => { void handleSendVibe(vibe); })}
        isSendingVibe={submittingLike}
      />
    </div>
  );
};

export default SwipeContainer;
