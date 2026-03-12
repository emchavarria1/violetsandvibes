import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService, LoginData } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';

interface LoginFormProps {
  onForgotPassword: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState<LoginData>({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authService.signIn(formData);
      toast({
        title: t("success"),
        description: t("loginSuccessDescription"),
      });
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect');
      const target = redirect && redirect.startsWith('/') ? redirect : '/social';
      navigate(target, { replace: true });
    } catch (error: any) {
      toast({
        title: t("loginFailed"),
        description: error.message || t("checkCredentials"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const email = formData.email.trim();
    if (!email) {
      toast({
        title: t('emailRequired'),
        description: t('enterEmailFirst'),
        variant: 'destructive',
      });
      return;
    }

    setIsResending(true);
    try {
      await authService.resendConfirmationEmail(email);
      toast({
        title: t('confirmationSent'),
        description: t('checkInboxForVerification'),
      });
    } catch (error: any) {
      toast({
        title: t('couldNotResendConfirmation'),
        description: error?.message || t('pleaseTryAgain'),
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/90">{t('email')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full bg-white text-black placeholder:text-gray-500 caret-black"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/90">{t('password')}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full bg-white text-black placeholder:text-gray-500 caret-black"
          />
        </div>
        
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto text-sm text-white/80 hover:text-white"
            onClick={() => void handleResendConfirmation()}
            disabled={isLoading || isResending}
          >
            {isResending ? t('sending') : t('resendConfirmationEmail')}
          </Button>
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto text-sm text-white/80 hover:text-white"
            onClick={onForgotPassword}
            disabled={isLoading || isResending}
          >
            {t('forgotPassword')}
          </Button>
        </div>
        
        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
          disabled={isLoading}
        >
          {isLoading ? t('signingIn') : t('signIn')}
        </Button>
      </form>
    </div>
  );
};

export default LoginForm;
