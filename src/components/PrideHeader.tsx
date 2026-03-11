import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { AnimatedLogo } from './AnimatedLogo';
import { HeaderDropdown } from './HeaderDropdown';

interface PrideHeaderProps {
  subtitle?: string;
  showLogo?: boolean;
  headerContent?: React.ReactNode;
  className?: string;
  onMenuSelect?: (action: string) => void;
}

export const PrideHeader: React.FC<PrideHeaderProps> = ({ 
  subtitle,
  showLogo = true,
  headerContent,
  className = '',
  onMenuSelect
}) => {
  return (
    <div className={`
      glass-pride-strong 
      px-3 sm:px-4 md:px-6
      pt-[calc(env(safe-area-inset-top)+3.4rem)] sm:pt-[calc(env(safe-area-inset-top)+4.25rem)]
      pb-4 sm:pb-6
      min-h-[132px] sm:min-h-[164px]
      mb-0
      relative
      overflow-hidden
      ${className}
    `}>
      <div className="pointer-events-none absolute inset-0 opacity-45">
        <div className="absolute -top-12 -left-10 h-40 w-40 rounded-full bg-pink-500/35 blur-3xl" />
        <div className="absolute -top-4 right-0 h-44 w-44 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-indigo-500/28 blur-3xl" />
      </div>

      {/* Header Dropdown */}
      <div className="absolute right-3 z-10 sm:right-4" style={{ top: "calc(env(safe-area-inset-top) + 1.85rem)" }}>
        <HeaderDropdown onMenuSelect={onMenuSelect} />
      </div>

      {/* Immediate safety visibility */}
      <div className="absolute left-2 z-10 sm:left-4" style={{ top: "calc(env(safe-area-inset-top) + 1.85rem)" }}>
        <Link
          to="/terms#community-standards"
          className="inline-flex items-center gap-1 rounded-full border border-pink-300/40 bg-black/45 px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-[11px] font-medium text-pink-100 hover:bg-black/60 transition-colors"
        >
          <ShieldAlert className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          Safety Standards
        </Link>
      </div>

      {headerContent ? (
        <div className="mb-0 px-2 sm:px-10 md:px-16 text-center">
          {headerContent}
        </div>
      ) : showLogo && (
        <AnimatedLogo
          size="lg"
          variant="global-flow"
          className="mb-0"
          text="Unleash Your Spirit with Violets & Vibes - Your Premier Online Dating and Social Hub!"
          textClassName="wedding-title vv-global-header-primary vv-global-header-flow px-2 sm:px-10 md:px-16 text-center"
        />
      )}
      
      {subtitle && (
        <p className="
          text-center 
          text-responsive 
          text-white/90 
          font-medium 
          mt-2 sm:mt-4
          drop-shadow-md
        ">
          {subtitle}
        </p>
      )}
      
      {/* Floating Pride Orbs */}
      <div className="absolute top-4 left-4 w-3 h-3 sm:w-4 sm:h-4 bg-pink-400 rounded-full floating-orb opacity-70 pointer-events-none"></div>
      <div className="absolute top-6 right-6 w-2 h-2 sm:w-3 sm:h-3 bg-purple-400 rounded-full floating-orb opacity-60 pointer-events-none" style={{animationDelay: '1s'}}></div>
      <div className="absolute bottom-4 right-4 w-3 h-3 sm:w-4 sm:h-4 bg-indigo-400 rounded-full floating-orb opacity-80 pointer-events-none" style={{animationDelay: '2s'}}></div>
    </div>
  );
};

export default PrideHeader;
