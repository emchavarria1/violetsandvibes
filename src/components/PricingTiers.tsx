import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Star, Zap, Sparkles } from 'lucide-react';
import {
  SubscriptionTier,
  SUBSCRIPTION_FEATURES,
  SUBSCRIPTION_PRICES,
  SUBSCRIPTION_TIER_LABELS,
} from '@/types/subscription';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeFunction } from '@/lib/supabase';

interface PricingTiersProps {
  currentTier: SubscriptionTier;
  onTierSelect?: (tier: SubscriptionTier, period: 'monthly' | 'yearly') => void;
}

const PricingTiers: React.FC<PricingTiersProps> = ({ currentTier, onTierSelect }) => {
  const { toast } = useToast();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const tiers = [
    {
      id: 'free' as SubscriptionTier,
      name: SUBSCRIPTION_TIER_LABELS.free,
      icon: <Zap className="h-6 w-6" />,
      color: 'bg-gray-100 text-gray-800',
      price: 0,
      description: 'Core access to get started',
      highlight: false
    },
    {
      id: 'premium' as SubscriptionTier,
      name: SUBSCRIPTION_TIER_LABELS.premium,
      icon: <Star className="h-6 w-6" />,
      color: 'bg-blue-100 text-blue-800',
      price: SUBSCRIPTION_PRICES.premium,
      description: 'Enhanced matching and communication tools',
      highlight: true,
      popular: true
    },
    {
      id: 'elite' as SubscriptionTier,
      name: SUBSCRIPTION_TIER_LABELS.elite,
      icon: <Crown className="h-6 w-6" />,
      color: 'bg-purple-100 text-purple-800',
      price: SUBSCRIPTION_PRICES.elite,
      description: 'Maximum visibility and premium perks',
      highlight: false,
      exclusive: true
    }
  ];

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (tier === currentTier) {
      toast({
        title: "Current Plan",
        description: `You're already subscribed to ${SUBSCRIPTION_TIER_LABELS[tier]}.`,
      });
      return;
    }

    let completed = false;
    setIsLoading(tier);
    try {
      const action = tier === 'free' ? 'cancel_subscription' : 'create_subscription';
      const { data, error } = await invokeEdgeFunction('handle-payment', {
        body:
          tier === 'free'
            ? { action }
            : {
                action,
                tier,
                billing_period: billingPeriod,
              },
      });

      if (error) throw error;

      if (data?.checkoutUrl || data?.checkout_url) {
        window.location.href = data?.checkoutUrl || data?.checkout_url;
        completed = true;
      } else if (data?.success) {
        toast({
          title: 'Plan updated',
          description:
            data?.message ||
            (tier === 'free'
              ? `You are now on ${SUBSCRIPTION_TIER_LABELS.free}.`
              : `You are now subscribed to ${SUBSCRIPTION_TIER_LABELS[tier]}.`),
        });
        completed = true;
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Error",
        description: "Unable to process payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(null);
    }

    if (completed && onTierSelect) {
      onTierSelect(tier, billingPeriod);
    }
  };

  const getFeatureList = (tier: SubscriptionTier) => {
    const features = SUBSCRIPTION_FEATURES[tier];
    const featureList = [
      `${features.maxPhotos} photos`,
      features.unlimitedLikes ? 'Unlimited likes' : 'Limited likes',
      features.advancedFilters ? 'Advanced filters' : null,
      features.videoChat ? 'Video chat' : null,
      features.priorityMatching ? 'Priority matching' : null,
      features.readReceipts ? 'Read receipts' : null,
      features.boostProfile ? 'Profile boost' : null,
      features.hideAds ? 'No ads' : null,
      features.incognitoMode ? 'Incognito mode' : null,
      features.seeWhoLikedYou ? 'See who liked you' : null,
      `${features.superLikes} super likes per day`,
      features.rewindSwipes ? 'Rewind swipes' : null,
    ].filter(Boolean);

    return featureList;
  };

  const getYearlySavings = (monthlyPrice: number) => {
    const yearlyPrice = monthlyPrice * 10; // 17% discount
    const monthlyCost = monthlyPrice * 12;
    return monthlyCost - yearlyPrice;
  };

  return (
    <div className="space-y-6">
      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="bg-white rounded-lg p-1 shadow-sm border">
          <Button
            variant={billingPeriod === 'monthly' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setBillingPeriod('monthly')}
          >
            Monthly
          </Button>
          <Button
            variant={billingPeriod === 'yearly' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setBillingPeriod('yearly')}
          >
            Yearly
            <Badge className="ml-2 bg-green-100 text-green-800">Save 17%</Badge>
          </Button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className={`relative transition-all duration-200 ${
              tier.popular ? 'ring-2 ring-blue-500 shadow-lg scale-105' : ''
            } ${tier.exclusive ? 'ring-2 ring-purple-500' : ''} ${
              currentTier === tier.id ? 'ring-2 ring-green-500' : ''
            }`}
          >
            {tier.popular && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500">
                Most Popular
              </Badge>
            )}
            {tier.exclusive && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-500">
                <Sparkles className="w-3 h-3 mr-1" />
                Exclusive
              </Badge>
            )}
            {currentTier === tier.id && (
              <Badge className="absolute -top-3 right-4 bg-green-500">
                Current Plan
              </Badge>
            )}
            
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                {tier.icon}
              </div>
              <CardTitle className="text-xl">{tier.name}</CardTitle>
              <p className="text-sm text-gray-600">{tier.description}</p>
              
              <div className="mt-4">
                {tier.id === 'free' ? (
                  <div className="text-3xl font-bold">$0<span className="text-sm font-normal text-gray-600">/month</span></div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-3xl font-bold">
                      ${billingPeriod === 'yearly' ? (tier.price.monthly * 10).toFixed(2) : tier.price[billingPeriod]}
                      <span className="text-sm font-normal text-gray-600">
                        /{billingPeriod === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>
                    {billingPeriod === 'yearly' && (
                      <p className="text-sm text-green-600">
                        Save ${getYearlySavings(tier.price.monthly).toFixed(2)} per year
                      </p>
                    )}
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
                onClick={() => handleSubscribe(tier.id)}
                className="w-full"
                variant={tier.popular ? 'default' : currentTier === tier.id ? 'outline' : 'outline'}
                disabled={isLoading === tier.id}
              >
                {isLoading === tier.id ? 'Processing...' : 
                 currentTier === tier.id ? 'Current Plan' :
                 tier.id === 'free' ? 'Downgrade' : `Get ${tier.name}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PricingTiers;
