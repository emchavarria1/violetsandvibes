import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Star, Zap } from 'lucide-react';
import {
  SubscriptionTier,
  SUBSCRIPTION_FEATURES,
  SUBSCRIPTION_PRICES,
  SUBSCRIPTION_TIER_LABELS,
} from '@/types/subscription';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  loadEffectiveSubscriptionTierForUser,
  saveSubscriptionTierForUser,
} from '@/lib/subscriptionTier';
import { invokeEdgeFunction } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';

const SubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useI18n();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [processingTier, setProcessingTier] = useState<SubscriptionTier | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  React.useEffect(() => {
    let cancelled = false;

    const loadTier = async () => {
      if (!user?.id) {
        setCurrentTier('free');
        return;
      }

      try {
        const tier = await loadEffectiveSubscriptionTierForUser(user.id);
        if (!cancelled) setCurrentTier(tier);
      } catch (error) {
        console.warn('Could not load subscription tier:', error);
        if (!cancelled) setCurrentTier('free');
      }
    };

    void loadTier();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const tiers = [
    {
      id: 'free' as SubscriptionTier,
      name: SUBSCRIPTION_TIER_LABELS.free,
      icon: <Zap className="h-6 w-6" />,
      color: 'bg-gray-100 text-gray-800',
      price: 0,
      description: t('coreAccessToGetStarted'),
    },
    {
      id: 'premium' as SubscriptionTier,
      name: SUBSCRIPTION_TIER_LABELS.premium,
      icon: <Star className="h-6 w-6" />,
      color: 'bg-purple-100 text-purple-800',
      price: SUBSCRIPTION_PRICES.premium,
      description: t('enhancedMatchingTools'),
      popular: true,
    },
    {
      id: 'elite' as SubscriptionTier,
      name: SUBSCRIPTION_TIER_LABELS.elite,
      icon: <Crown className="h-6 w-6" />,
      color: 'bg-yellow-100 text-yellow-800',
      price: SUBSCRIPTION_PRICES.elite,
      description: t('maximumVisibilityPerks'),
    },
  ];

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!user?.id) {
      navigate('/signin?redirect=/subscription', { replace: true });
      return;
    }

    if (tier === currentTier) {
      toast({
        title: t('currentPlan'),
        description: `You are already on ${SUBSCRIPTION_TIER_LABELS[tier]}.`,
      });
      return;
    }

    try {
      setProcessingTier(tier);
      if (tier === 'free') {
        await saveSubscriptionTierForUser(user.id, tier);
        setCurrentTier(tier);

        toast({
          title: t('save'),
          description: `You are now on ${SUBSCRIPTION_TIER_LABELS.free}.`,
        });
        return;
      }

      const { data, error } = await invokeEdgeFunction('handle-payment', {
        body: {
          action: 'create_subscription',
          tier,
          billingPeriod,
        },
      });

      if (error) throw error;

      if (data?.checkoutUrl || data?.checkout_url) {
        const checkoutUrl = data?.checkoutUrl || data?.checkout_url;
        window.location.href = checkoutUrl;
        return;
      }

      if (data?.success) {
        await saveSubscriptionTierForUser(user.id, tier);
        setCurrentTier(tier);
        toast({
          title: t('save'),
          description: data?.message || `You are now on ${SUBSCRIPTION_TIER_LABELS[tier]}.`,
        });
        return;
      }

      toast({
        title: t('payments'),
        description:
          'Subscription checkout is not configured yet. Paid tiers stay locked until payment is enabled.',
      });
    } catch (error: any) {
      console.error('Failed to start subscription checkout:', error);
      toast({
        title: t('error'),
        description:
          error?.message ||
          'Could not start checkout. Paid tiers remain locked.',
        variant: 'destructive',
      });
    } finally {
      setProcessingTier(null);
    }
  };

  const getFeatureList = (tier: SubscriptionTier) => {
    const features = SUBSCRIPTION_FEATURES[tier];
    const featureList = [
      `${features.maxPhotos} photos`,
      features.unlimitedLikes ? t('unlimitedLikes') : t('limitedLikes'),
      features.advancedFilters ? t('advancedFilters') : null,
      features.videoChat ? t('videoChat') : null,
      features.priorityMatching ? t('priorityMatching') : null,
      features.readReceipts ? t('readReceipts') : null,
      features.boostProfile ? t('profileBoost') : null,
      features.hideAds ? t('noAds') : null,
      features.incognitoMode ? t('incognitoMode') : null,
      features.seeWhoLikedYou ? t('seeWhoLikedYou') : null,
      t('superLikesPerDay', { count: features.superLikes }),
      features.rewindSwipes ? t('rewindSwipes') : null,
    ].filter(Boolean);

    return featureList;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('chooseYourPlan')}</h1>
          <p className="text-gray-600">{t('choosePlanFitsYou')}</p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm">
            <Button
              variant={billingPeriod === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('monthly')}
            >
              {t('monthly')}
            </Button>
            <Button
              variant={billingPeriod === 'yearly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('yearly')}
            >
              {t('yearly')}
              <Badge className="ml-2 bg-green-100 text-green-800">{t('savePercent', { percent: 17 })}</Badge>
            </Button>
          </div>
        </div>

        {/* Subscription Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <Card
              key={tier.id}
              className={`relative ${
                tier.popular ? 'ring-2 ring-purple-500 shadow-lg' : ''
              } ${currentTier === tier.id ? 'ring-2 ring-green-500' : ''}`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-500">
                  {t('mostPopular')}
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  {tier.icon}
                </div>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                
                <div className="mt-4">
                  {tier.id === 'free' ? (
                    <div className="text-3xl font-bold">$0<span className="text-sm font-normal text-gray-600">{t('perMonth')}</span></div>
                  ) : (
                    <div className="text-3xl font-bold">
                      ${tier.price[billingPeriod]}
                      <span className="text-sm font-normal text-gray-600">
                          {billingPeriod === 'monthly' ? t('perMonth') : t('perYear')}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2 mb-6">
                  {getFeatureList(tier.id).map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => void handleSubscribe(tier.id)}
                  className="w-full"
                  variant={currentTier === tier.id ? 'outline' : tier.popular ? 'default' : 'outline'}
                  disabled={!!processingTier || currentTier === tier.id}
                >
                  {processingTier === tier.id
                    ? `${t('update')}...`
                    : currentTier === tier.id
                    ? t('currentPlan')
                    : tier.id === 'free'
                    ? t('switchToPlan', { plan: SUBSCRIPTION_TIER_LABELS.free })
                    : t('getPlan', { plan: tier.name })}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            ← {t('back')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
