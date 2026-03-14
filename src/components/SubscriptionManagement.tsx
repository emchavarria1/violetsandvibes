import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, CreditCard, Crown, Star, Zap } from 'lucide-react';
import { SubscriptionTier, SUBSCRIPTION_TIER_LABELS } from '@/types/subscription';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeFunction } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';

interface SubscriptionManagementProps {
  currentTier: SubscriptionTier;
  onUpgrade: () => void;
  onTierChange?: (tier: SubscriptionTier) => void;
}

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({
  currentTier,
  onUpgrade,
  onTierChange,
}) => {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUpdatingPaymentMethod, setIsUpdatingPaymentMethod] = useState(false);
  const isIOS = Capacitor.getPlatform() === 'ios';

  const subscriptionData = {
    nextBillingDate: '2024-09-15',
    daysRemaining: 23,
    autoRenew: true,
    paymentMethod: '4242',
    usageStats: {
      superLikes: { used: 3, total: 5 },
      boosts: { used: 1, total: 3 },
      rewinds: { used: 7, total: 10 }
    }
  };

  const tierInfo = {
    free: { name: SUBSCRIPTION_TIER_LABELS.free, icon: <Zap className="w-5 h-5" />, color: 'bg-gray-100 text-gray-800' },
    premium: { name: SUBSCRIPTION_TIER_LABELS.premium, icon: <Star className="w-5 h-5" />, color: 'bg-blue-100 text-blue-800' },
    elite: { name: SUBSCRIPTION_TIER_LABELS.elite, icon: <Crown className="w-5 h-5" />, color: 'bg-purple-100 text-purple-800' }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(t('cancelSubscription'))) return;
    
    setIsCancelling(true);
    try {
      const { data, error } = await invokeEdgeFunction('handle-payment', {
        body: { action: 'cancel_subscription' },
      });

      if (error) throw error;

      onTierChange?.('free');
      toast({
        title: t('cancelSubscription'),
        description:
          data?.message || 'Your plan has been switched to 💜 Violets Verified Free.',
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failedToCancelSubscription'),
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    setIsUpdatingPaymentMethod(true);
    try {
      const { data, error } = await invokeEdgeFunction('handle-payment', {
        body: { action: 'update_payment_method' },
      });
      if (error) throw error;

      toast({
        title: t('paymentMethod'),
        description: data?.message || 'Payment method flow is available.',
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failedToOpenPaymentFlow'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPaymentMethod(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {tierInfo[currentTier].icon}
            {t('currentSubscription')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Badge className={tierInfo[currentTier].color}>
                {tierInfo[currentTier].name}
              </Badge>
              {currentTier !== 'free' && (
                <p className="text-sm text-gray-600 mt-1">
                  {t('renewsOn', { date: subscriptionData.nextBillingDate })}
                </p>
              )}
            </div>
            {currentTier === 'free' ? (
              <Button onClick={onUpgrade} className="bg-pink-500 hover:bg-pink-600">
                {t('upgradeNow')}
              </Button>
            ) : (
              <Button variant="outline" onClick={onUpgrade}>
                {t('changePlan')}
              </Button>
            )}
          </div>

          {currentTier !== 'free' && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {t('daysRemaining', { count: subscriptionData.daysRemaining })}
                </span>
              </div>
              <Progress 
                value={(subscriptionData.daysRemaining / 30) * 100} 
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {currentTier !== 'free' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('usageThisMonth')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(subscriptionData.usageStats).map(([key, stats]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{key}</span>
                  <span>{stats.used}/{stats.total}</span>
                </div>
                <Progress value={(stats.used / stats.total) * 100} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {currentTier !== 'free' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {t('paymentMethod')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {isIOS ? t('managedThroughAppStore') : `Card ending in ${subscriptionData.paymentMethod}`}
                </p>
                <p className="text-sm text-gray-600">
                  {isIOS ? t('subscriptionBillingManagedByApple') : t('autoRenewEnabled')}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => void handleUpdatePaymentMethod()}
                disabled={isUpdatingPaymentMethod}
              >
                {isUpdatingPaymentMethod ? `${t('opening')}...` : t('update')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentTier !== 'free' && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={() => void handleCancelSubscription()}
              disabled={isCancelling}
            >
              {isCancelling ? `${t('cancelling')}...` : t('cancelSubscription')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SubscriptionManagement;
