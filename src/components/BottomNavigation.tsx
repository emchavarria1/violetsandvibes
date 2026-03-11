import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNotifications } from "@/hooks/useNotifications";
import { 
  Compass, 
  Heart, 
  MessageCircle, 
  User, 
  Calendar,
  Users,
  Bell
} from 'lucide-react';

const BottomNavigation: React.FC = () => {
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  const navItems = [
    { path: '/discover', icon: Compass, label: 'Discover' },
    { path: '/matches', icon: Heart, label: 'Matches' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/notifications', icon: Bell, label: 'Alerts' },
    { path: '/social', icon: Users, label: 'Social' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/profile', icon: User, label: 'Profile' }
  ];

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 24) {
        setIsVisible(true);
      } else if (currentScrollY < lastScrollY - 6) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY + 10 && currentScrollY > 120) {
        setIsVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 px-2 pb-2 transition-transform duration-300 sm:px-4 ${
        isVisible ? 'translate-y-0' : 'translate-y-[110%]'
      }`}
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto w-full max-w-4xl rounded-[22px] border border-white/15 bg-[linear-gradient(180deg,rgba(35,16,68,0.95),rgba(24,10,51,0.98))] px-1 py-1.5 shadow-[0_-10px_35px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="grid grid-cols-7 items-stretch gap-1">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive =
              location.pathname === path || location.pathname.startsWith(path + "/");
            return (
              <Link
                key={path}
                to={path}
                className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-center transition-all duration-200 ${
                  isActive 
                    ? 'bg-white/10 text-white'
                    : 'text-white/65 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="relative">
                  <Icon className={`h-[18px] w-[18px] sm:h-5 sm:w-5 ${isActive ? 'text-pink-400' : ''}`} />
                  {path === "/notifications" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </div>
                <span className={`mt-1 block max-w-full truncate px-0.5 text-[10px] leading-tight sm:text-[11px] ${isActive ? 'text-white' : 'text-white/72'}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNavigation;
export { BottomNavigation };
