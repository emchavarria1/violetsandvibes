import React from 'react';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'default' | 'global-flow';
  text?: string;
  textClassName?: string;
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ 
  size = 'md', 
  className = '',
  variant = 'default',
  text = 'Violets & Vibes',
  textClassName = ''
}) => {
  const useWaterFlowHeader = variant === 'global-flow';
  const interactionClasses = useWaterFlowHeader
    ? 'transform-gpu'
    : 'transition-all duration-300 hover:scale-105 hover:drop-shadow-2xl filter drop-shadow-lg';
  const sizeClasses = {
    sm: 'text-lg sm:text-xl',
    md: 'text-xl sm:text-2xl md:text-3xl',
    lg: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl',
    xl: 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <h1 className={`
        wedding-heading
        ${sizeClasses[size]} 
        font-bold text-center
        ${useWaterFlowHeader ? '' : 'rainbow-header-static'}
        ${interactionClasses}
        ${textClassName}
      `}>
        {text}
      </h1>
    </div>
  );
};

export default AnimatedLogo;
