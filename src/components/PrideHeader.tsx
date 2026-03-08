import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { AnimatedLogo } from './AnimatedLogo';
import { HeaderDropdown } from './HeaderDropdown';

interface PrideHeaderProps {
  subtitle?: string;
  showLogo?: boolean;
  className?: string;
  onMenuSelect?: (action: string) => void;
}

export const PrideHeader: React.FC<PrideHeaderProps> = ({ 
  subtitle,
  showLogo = true,
  className = '',
  onMenuSelect
}) => {
  return (
    <div className={`
      glass-pride-strong 
      padding-responsive 
      mb-4 sm:mb-6 md:mb-8
      relative
      ${className}
    `}>
      {/* Header Dropdown */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
        <HeaderDropdown onMenuSelect={onMenuSelect} />
      </div>

      {/* Immediate safety visibility */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10">
        <Link
          to="/terms#community-standards"
          className="inline-flex items-center gap-1 rounded-full border border-pink-300/40 bg-black/45 px-2 py-1 text-[11px] sm:text-xs font-medium text-pink-100 hover:bg-black/60 transition-colors"
        >
          <ShieldAlert className="h-3 w-3" />
          Safety Standards
        </Link>
      </div>

      {showLogo && (
        <AnimatedLogo
          size="lg"
          variant="global-flow"
          className="mb-2 sm:mb-4"
          text="Unleash Your Spirit with Violets & Vibes - Your Premier Online Dating and Social Hub!"
          textClassName="wedding-title vv-global-header-flow leading-tight px-6 sm:px-14 md:px-20"
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
