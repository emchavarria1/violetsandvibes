import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/i18n';

interface PasswordResetFormProps {
  onBack: () => void;
}

export function PasswordResetForm({ onBack }: PasswordResetFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      await authService.resetPassword(email);
      toast({
        title: t('resetEmailSent'),
        description: t('checkEmailResetInstructions'),
      });
      setEmail('');
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message || t('failedToSendResetEmail'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('resetPassword')}</CardTitle>
        <CardDescription>
          {t('enterYourEmailToReset')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">{t('email')}</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder={t('enterYourEmail')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? t('sending') : t('sendResetEmail')}
            </Button>
            <Button type="button" variant="outline" onClick={onBack}>
              {t('back')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
