import React from 'react';
import { PrideHeader } from './PrideHeader';
import { BottomNavigation } from './BottomNavigation';
import { ResponsiveWrapper } from './ResponsiveWrapper';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';

interface GlobalLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showBottomNav?: boolean;
  className?: string;
}

export const GlobalLayout: React.FC<GlobalLayoutProps> = ({ 
  children, 
  showHeader = true, 
  showBottomNav = true,
  className = ""
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const handleMenuSelect = (action: string) => {
    switch (action) {
      case 'heroes':
        navigate('/heroes');
        break;
      case 'discover':
        navigate('/discover');
        break;
      case 'profile':
        navigate('/profile');
        break;
      case 'matches':
        navigate('/matches');
        break;
      case 'social':
        navigate('/social');
        break;
      case 'chat':
        navigate('/chat');
        break;
      case 'video':
        navigate('/video');
        break;
      case 'events':
        navigate('/events');
        break;
      case 'calendar':
        navigate('/calendar');
        break;
      case 'notifications':
        navigate('/notifications');
        break;
      case 'verification':
        navigate('/verification');
        break;
      case 'filters':
        navigate('/filters');
        break;
      case 'settings':
        navigate('/settings');
        break;
      case 'subscription':
        navigate('/subscription');
        break;
      case 'admin':
        navigate('/admin');
        break;
      case 'logout':
        navigate('/signin');
        break;
      default:
        break;
    }
  };

  const headerContent = React.useMemo(() => {
    switch (location.pathname) {
      case '/discover':
        return (
          <div className="vv-global-header-shell space-y-2 text-center">
            <div className="vv-global-header-primary vv-global-header-flow">
              Unleash Your Spirit
            </div>
            <div className="vv-global-header-secondary vv-global-header-flow">with Violets &amp; Vibes</div>
          </div>
        );
      case '/matches':
        return (
          <div className="vv-global-header-shell space-y-3 text-center">
            <div className="vv-global-header-primary vv-global-header-flow">
              Violets &amp; Vibes
            </div>
            <div className="mx-auto h-[3px] w-32 rounded-full bg-gradient-to-r from-pink-400 via-violet-400 to-indigo-400" />
            <div className="vv-global-header-secondary vv-global-header-flow">
              Connect safely. Belong fully.
            </div>
          </div>
        );
      case '/social':
        return (
          <div className="vv-global-header-shell space-y-2 text-center">
            <div className="vv-global-header-primary vv-global-header-flow">
              Violets &amp; Vibes
            </div>
            <div className="vv-global-header-secondary vv-global-header-flow">A sanctuary for connection and kindness.</div>
          </div>
        );
      case '/notifications':
        return (
          <div className="vv-global-header-shell space-y-2 text-center">
            <div className="vv-global-header-primary vv-global-header-flow">
              Your Dating &amp; Social Notifications Hub!
            </div>
          </div>
        );
      case '/calendar':
        return (
          <div className="vv-global-header-shell space-y-2 text-center">
            <div className="vv-global-header-primary vv-global-header-flow font-['Inter']">
              Violets and Vibes Social Calendar
            </div>
          </div>
        );
      case '/profile':
        return (
          <div className="vv-global-header-shell space-y-2 text-center">
            <div className="vv-global-header-primary vv-global-header-flow">
              Make your profile match your vibe!
            </div>
          </div>
        );
      case '/settings':
        return (
          <div className="vv-global-header-shell space-y-2 text-center">
            <div className="vv-global-header-primary vv-global-header-flow">
              Your App Prefferences
            </div>
          </div>
        );
      case '/chat':
        return (
          <div className="vv-global-header-shell space-y-2 text-center">
            <div className="vv-global-header-label vv-global-header-flow">
              {t('messages')}
            </div>
            <div className="vv-global-header-primary vv-global-header-flow">
              Violets &amp; Vibes
            </div>
            <div className="vv-global-header-secondary vv-global-header-flow">
              Women-centered • Inclusive • Safety-first
            </div>
            <div className="mt-4 border-b border-white/10" />
          </div>
        );
      default:
        return undefined;
    }
  }, [location.pathname]);

  return (
    <div
      className={`min-h-screen flex flex-col ${className}`}
      style={{ paddingTop: showHeader ? "0" : "calc(env(safe-area-inset-top) + 0.25rem)" }}
    >
      {/* Header */}
      {showHeader && (
        <div className="relative z-20">
          <PrideHeader
            onMenuSelect={handleMenuSelect}
            headerContent={headerContent}
            showLogo={!headerContent}
            className="mb-0 sm:mb-0 md:mb-0"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
        {children}
      </div>

      {/* Bottom Navigation */}
      {showBottomNav && <BottomNavigation />}
    </div>
  );
};

export default GlobalLayout;
