import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LoginForm from '@/components/LoginForm';
import CreateAccountForm from '@/components/CreateAccountForm';
import { PasswordResetForm } from '@/components/PasswordResetForm';
import { authService, AuthUser } from '@/lib/auth';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ResponsiveWrapper } from '@/components/ResponsiveWrapper';
import { useProfileStatus } from '@/hooks/useProfileStatus';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/i18n';

const SignInPage: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('login');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { status } = useProfileStatus();
  const { toast } = useToast();
  const { t } = useI18n();

  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect');
  const redirectTarget = redirect && redirect.startsWith('/') ? redirect : '/social';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = (params.get('tab') || '').toLowerCase();
    if (tabParam === 'register' || tabParam === 'signup' || tabParam === 'create') {
      setActiveTab('register');
      return;
    }
    if (tabParam === 'login' || tabParam === 'signin') {
      setActiveTab('login');
    }
  }, [location.search]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error checking user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      setUser(user);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const socialError = params.get('social_error');
    if (!socialError) return;

    const provider = params.get('provider') || 'social provider';
    const humanReason = socialError.replace(/_/g, ' ');

    toast({
      title: t('socialLoginFailed', { provider }),
      description: humanReason,
      variant: 'destructive',
    });

    params.delete('social_error');
    params.delete('provider');
    const next = params.toString();
    const cleanUrl = `${location.pathname}${next ? `?${next}` : ''}`;
    window.history.replaceState({}, '', cleanUrl);
  }, [location.pathname, location.search, toast]);

  if (isLoading) {
    return (
      <div className="page-calm min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (user) {
    if (status === "loading") {
      return (
        <div className="page-calm min-h-screen flex items-center justify-center">
          <div className="text-white/80">{t('checkingProfile')}</div>
        </div>
      );
    }

    if (status === "incomplete") {
      const next = encodeURIComponent(redirectTarget);
      return <Navigate to={`/create-new-profile?redirect=${next}`} replace />;
    }

    return <Navigate to={redirectTarget} replace />;
  }

  return (
    <div className="page-calm min-h-screen flex flex-col relative">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-pink-400/20 rounded-full floating-orb blur-xl"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-purple-400/20 rounded-full floating-orb blur-lg" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-40 left-20 w-28 h-28 bg-indigo-400/20 rounded-full floating-orb blur-xl" style={{animationDelay: '4s'}}></div>
        <div className="absolute bottom-20 right-10 w-20 h-20 bg-cyan-400/20 rounded-full floating-orb blur-lg" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative z-10 overflow-y-auto">
        <ResponsiveWrapper maxWidth="xl" className="h-full py-6 sm:py-8">
          {/* Auth Forms */}
          <div className="flex justify-center">
            <div className="w-full max-w-md rounded-[30px] border border-pink-200/30 bg-gradient-to-r from-fuchsia-500/20 via-indigo-500/15 to-pink-500/20 p-[1px] shadow-2xl">
              <Card className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-[#220b46]/95 via-[#2d1258]/95 to-[#34134d]/95">
                <div className="pointer-events-none absolute -left-16 -top-16 h-36 w-36 rounded-full bg-pink-400/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-14 right-4 h-28 w-28 rounded-full bg-indigo-400/20 blur-3xl" />

                <div className="border-b border-white/15 p-5 sm:p-6 text-center">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="h-1.5 flex-1 rounded-full bg-rose-400" />
                    <span className="h-1.5 flex-1 rounded-full bg-orange-400" />
                    <span className="h-1.5 flex-1 rounded-full bg-amber-300" />
                    <span className="h-1.5 flex-1 rounded-full bg-emerald-400" />
                    <span className="h-1.5 flex-1 rounded-full bg-sky-400" />
                    <span className="h-1.5 flex-1 rounded-full bg-indigo-400" />
                    <span className="h-1.5 flex-1 rounded-full bg-fuchsia-400" />
                  </div>

                  <h1 className="mx-auto max-w-[11ch] text-center text-4xl sm:text-5xl wedding-title leading-[0.98] vv-global-header-flow">
                    {t('friendshipDatingCommunityWithIntention')}
                  </h1>
                </div>

                <CardHeader className="pb-4 pt-5 text-center">
                <CardTitle className="text-2xl text-white wedding-heading text-center">
                  {showPasswordReset ? t('resetPassword') : t('joinTheCommunity')}
                </CardTitle>
                {showPasswordReset ? (
                  <CardDescription className="text-white/70 text-center">
                    {t('enterYourEmailToReset')}
                  </CardDescription>
                ) : null}
                </CardHeader>
                <CardContent className="px-5 pb-5 sm:px-6">
                  {showPasswordReset ? (
                    <PasswordResetForm onBack={() => setShowPasswordReset(false)} />
                  ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="mb-6 grid w-full grid-cols-2 rounded-xl bg-[#5a2386]/70 p-1">
                        <TabsTrigger value="login" className="rounded-lg text-white data-[state=active]:bg-[#4f1f76] data-[state=active]:text-white">{t('signIn')}</TabsTrigger>
                        <TabsTrigger value="register" className="rounded-lg text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white">{t('createAccount')}</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="login">
                        <LoginForm onForgotPassword={() => setShowPasswordReset(true)} />
                      </TabsContent>
                      
                      <TabsContent value="register">
                        <CreateAccountForm />
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>

                <div className="border-t border-white/15 px-5 pb-5 pt-4 text-center sm:px-6">
                  <div className="wedding-title text-center text-4xl leading-[0.98] vv-global-header-flow">
                    {t('womenCenteredInclusiveSafetyFirst')}
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-4 text-xs text-white/70 sm:text-sm">
                    <Link className="hover:text-white underline underline-offset-4" to="/privacy">
                      {t('privacyPolicy')}
                    </Link>
                    <Link className="hover:text-white underline underline-offset-4" to="/terms">
                      {t('termsOfService')}
                    </Link>
                    <Link className="hover:text-white underline underline-offset-4" to="/data-deletion">
                      {t('dataDeletion')}
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </ResponsiveWrapper>
      </div>
    </div>
  );
};

export default SignInPage;
