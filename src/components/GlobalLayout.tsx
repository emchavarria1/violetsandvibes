import React from 'react';
import { PrideHeader } from './PrideHeader';
import { BottomNavigation } from './BottomNavigation';
import { ResponsiveWrapper } from './ResponsiveWrapper';
import { useLocation, useNavigate } from 'react-router-dom';

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
          <div className="space-y-1">
            <div className="text-3xl md:text-5xl font-semibold tracking-tight vv-global-header-flow">
              Unleash Your Spirit
            </div>
            <div className="text-2xl md:text-3xl text-pink-300">with Violets &amp; Vibes</div>
          </div>
        );
      case '/matches':
        return (
          <div className="space-y-3">
            <div className="text-4xl md:text-5xl font-semibold tracking-tight vv-global-header-flow">
              Violets &amp; Vibes
            </div>
            <div className="h-[3px] w-32 rounded-full bg-gradient-to-r from-pink-400 via-violet-400 to-indigo-400" />
            <div className="text-lg text-white/70">
              Connect safely. Belong fully.
            </div>
          </div>
        );
      case '/social':
        return (
          <div className="space-y-1">
            <div className="text-4xl md:text-5xl font-bold tracking-tight text-violet-200 drop-shadow-[0_0_6px_rgba(167,139,250,0.7)]">
              Violets &amp; Vibes
            </div>
            <div className="text-lg text-violet-300/80">A sanctuary for connection and kindness.</div>
          </div>
        );
      case '/notifications':
        return (
          <div className="space-y-1">
            <div className="text-3xl md:text-4xl font-semibold tracking-tight text-[#d8e8cf]">
              Your Dating &amp; Social Notifications Hub!
            </div>
          </div>
        );
      case '/chat':
        return (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-white/40">
              Messages
            </div>
            <div className="text-3xl md:text-4xl font-semibold tracking-tight bg-gradient-to-r from-pink-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Violets &amp; Vibes
            </div>
            <div className="text-lg text-white/70">
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
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.25rem)" }}
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
      {showBottomNav && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <BottomNavigation />
        </div>
      )}
    </div>
  );
};

export default GlobalLayout;
