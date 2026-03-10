import React from 'react';
import { PrideHeader } from './PrideHeader';
import { BottomNavigation } from './BottomNavigation';
import { ResponsiveWrapper } from './ResponsiveWrapper';
import { useNavigate } from 'react-router-dom';

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
