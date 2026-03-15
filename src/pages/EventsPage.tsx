import React from 'react';
import CalendarIntegration from '@/components/CalendarIntegration';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const EventsPage: React.FC = () => {
  return (
    <div className="page-gradient min-h-screen flex flex-col relative">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-pink-400/20 rounded-full floating-orb blur-xl"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-purple-400/20 rounded-full floating-orb blur-lg" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-40 left-20 w-28 h-28 bg-indigo-400/20 rounded-full floating-orb blur-xl" style={{animationDelay: '4s'}}></div>
        <div className="absolute bottom-20 right-10 w-20 h-20 bg-cyan-400/20 rounded-full floating-orb blur-lg" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="h-full w-full px-0 sm:px-2 lg:px-3 xl:px-4 2xl:px-5">
          <div className="glass-pride min-h-full overflow-visible rounded-none sm:rounded-2xl">
            <div className="flex justify-end border-b border-white/15 p-2.5 sm:p-3">
              <Button
                asChild
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                <Link to="/social">Back to Events Feed</Link>
              </Button>
            </div>
            <CalendarIntegration />
          </div>
        </div>
      </div>
    </div>
  );
};
export default EventsPage;
