import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { authService, SignUpData } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/i18n';

interface FormData extends SignUpData {
  confirmPassword: string;
}

const CreateAccountForm: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [boundaryConfirmed, setBoundaryConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

    if (!boundaryConfirmed) {
      toast({
        title: t("confirmationRequired"),
        description: t("confirmPlatformBoundary"),
        variant: "destructive",
      });
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t("passwordMismatch"),
        description: t("passwordsDoNotMatch"),
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: t("passwordTooShort"),
        description: t("passwordMinLength"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const authData = await authService.signUp({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      const hasSession = !!authData?.session;
      toast({
        title: t("accountCreated"),
        description: hasSession
          ? t("youAreNowSignedIn")
          : t("checkEmailToVerify"),
      });
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      setBoundaryConfirmed(false);
    } catch (error: any) {
      const raw = String(error?.message || '').toLowerCase();

      // If sign-up confirmation email fails but account is actually active,
      // fall back to sign-in immediately so the user can continue.
      if (raw.includes('confirmation email')) {
        try {
          await authService.signIn({
            email: formData.email,
            password: formData.password,
          });

          toast({
            title: t("accountCreatedSignedIn"),
            description: t("accountActiveSignedIn"),
          });
          return;
        } catch {
          // Keep original signup error toast below.
        }
      }

      toast({
        title: t("registrationFailed"),
        description: error.message || t("pleaseTryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-white/90">{t('fullName')}</Label>
          <Input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full bg-white text-black placeholder:text-gray-500 caret-black"
          />
        </div>
        
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
            minLength={6}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-white/90">{t('confirmPassword')}</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            className="w-full bg-white text-black placeholder:text-gray-500 caret-black"
          />
        </div>

        <div className="rounded-lg border border-pink-300/35 bg-pink-500/10 p-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="boundary-confirmation"
              className="mt-0.5 h-5 w-5 border-2 border-white data-[state=checked]:bg-pink-500 data-[state=checked]:text-white"
              checked={boundaryConfirmed}
              onCheckedChange={(checked) => setBoundaryConfirmed(checked === true)}
            />
            <Label
              htmlFor="boundary-confirmation"
              className="text-sm leading-relaxed text-white/90"
            >
              <span className="font-semibold text-pink-200">{t('required')} </span>
              {t('boundaryConfirmation')}
            </Label>
          </div>
        </div>
        
        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
          disabled={isLoading || !boundaryConfirmed}
        >
          {isLoading ? t('creatingAccount') : t('createAccount')}
        </Button>
      </form>
    </div>
  );
};

export default CreateAccountForm;
