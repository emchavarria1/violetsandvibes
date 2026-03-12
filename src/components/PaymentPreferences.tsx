import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Shield,
  DollarSign,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import PaymentForm from './PaymentForm';
import { SUBSCRIPTION_TIER_LABELS, SubscriptionTier } from '@/types/subscription';
import { useI18n } from '@/lib/i18n';

interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

interface PaymentPreferencesProps {
  currentTier: string;
  onUpgrade: () => void;
}

const PaymentPreferences: React.FC<PaymentPreferencesProps> = ({ 
  currentTier, 
  onUpgrade 
}) => {
  const { toast } = useToast();
  const { t } = useI18n();
  const isIOS = Capacitor.getPlatform() === 'ios';
  const currentTierKey: SubscriptionTier =
    currentTier === 'premium' || currentTier === 'elite' ? currentTier : 'free';
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: '1',
      type: 'card',
      last4: '4242',
      brand: 'visa',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true
    }
  ]);

  const [preferences, setPreferences] = useState({
    autoRenew: true,
    emailReceipts: true,
    smsNotifications: false,
    billingReminders: true
  });

  const handlePayment = async (action: string, data?: any) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('handle-payment', {
        body: { action, ...data }
      });

      if (error) throw error;

      toast({
        title: t('success'),
        description: result.message,
      });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addPaymentMethod = () => {
    toast({
      title: t('addPaymentMethod'),
      description: t('redirectingToSecurePaymentSetup'),
    });
  };

  const removePaymentMethod = (id: string) => {
    setPaymentMethods(prev => prev.filter(method => method.id !== id));
    toast({
      title: "Payment Method Removed",
      description: "Payment method has been removed successfully.",
    });
  };

  const setDefaultPaymentMethod = (id: string) => {
    setPaymentMethods(prev => 
      prev.map(method => ({
        ...method,
        isDefault: method.id === id
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {isIOS ? t('billing') : t('paymentMethods')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isIOS ? (
            <div className="rounded-lg border p-4">
              <p className="font-medium">{t('managedThroughAppStore')}</p>
              <p className="mt-1 text-sm text-gray-500">
                {t('subscriptionBillingManagedByApple')}
              </p>
            </div>
          ) : (
            <>
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">
                        {method.brand?.toUpperCase()} •••• {method.last4}
                      </p>
                      <p className="text-sm text-gray-500">
                        {t('expires', { month: method.expiryMonth, year: method.expiryYear })}
                      </p>
                    </div>
                    {method.isDefault && (
                      <Badge variant="secondary">{t('defaultLabel')}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.isDefault && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setDefaultPaymentMethod(method.id)}
                      >
                        {t('setDefault')}
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removePaymentMethod(method.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={addPaymentMethod}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('addPaymentMethod')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Billing Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            {t('billingPreferences')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">{t('autoRenewal')}</p>
              <p className="text-sm text-gray-500">{t('automaticallyRenewSubscription')}</p>
            </div>
            <Switch 
              checked={preferences.autoRenew}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, autoRenew: checked }))
              }
            />
          </div>
          
          <Separator />
          
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">{t('emailReceipts')}</p>
              <p className="text-sm text-gray-500">{t('receivePaymentConfirmations')}</p>
            </div>
            <Switch 
              checked={preferences.emailReceipts}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, emailReceipts: checked }))
              }
            />
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">{t('smsNotifications')}</p>
              <p className="text-sm text-gray-500">{t('receiveBillingAlertsViaSms')}</p>
            </div>
            <Switch 
              checked={preferences.smsNotifications}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, smsNotifications: checked }))
              }
            />
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">{t('billingReminders')}</p>
              <p className="text-sm text-gray-500">{t('getNotifiedBeforeRenewal')}</p>
            </div>
            <Switch 
              checked={preferences.billingReminders}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, billingReminders: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Premium Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t('violetsVerifiedServices')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentTier === 'free' ? (
            <div className="text-center py-6">
              <p className="text-gray-600 mb-4">{t('unlockUpgrades')}</p>
              <Button 
                onClick={() => handlePayment('create_subscription', { tier: 'premium' })} 
                className="bg-pink-500 hover:bg-pink-600"
              >
                Upgrade to {SUBSCRIPTION_TIER_LABELS.premium}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Current Plan</span>
                <Badge className="bg-purple-100 text-purple-800">
                  {SUBSCRIPTION_TIER_LABELS[currentTierKey]}
                </Badge>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handlePayment('update_payment_method')}
              >
                <Calendar className="w-4 h-4 mr-2" />
                {t('manageSubscription')}
              </Button>
              
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={() => handlePayment('cancel_subscription')}
              >
                {t('cancelSubscription')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentPreferences;
