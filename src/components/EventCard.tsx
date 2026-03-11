import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, Heart, Sparkles, Share2 } from 'lucide-react';

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string;
    date: string;
    time: string;
    location: string;
    attendees: number;
    maxAttendees: number;
    tags: string[];
    organizer: string;
    image?: string;
    isAttending?: boolean;
  };
  onJoin?: (eventId: string) => void;
  onLike?: (eventId: string) => void;
  onInvite?: (eventId: string) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, onJoin, onLike, onInvite }) => {
  return (
    <Card className="mb-4 overflow-hidden border-0 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 group relative bg-black/90 backdrop-blur-sm text-white">
      {/* Identity-based gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-200/30 via-purple-200/30 to-indigo-200/30" />
      <div className="absolute inset-0 bg-gradient-to-tr from-yellow-200/20 via-green-200/20 to-blue-200/20" />
      
      {/* Floating sparkles */}
      <div className="absolute top-3 right-3">
        <Sparkles className="w-4 h-4 text-pink-400" />
      </div>
      <div className="absolute top-8 right-8">
        <Sparkles className="w-3 h-3 text-purple-400" />
      </div>

      
      {/* Enhanced image section */}
      {event.image && (
        <div className="h-48 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300 flex items-center justify-center relative overflow-hidden group-hover:from-pink-400 group-hover:via-purple-400 group-hover:to-indigo-400 transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent animate-pulse" />
          <span className="text-5xl group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 drop-shadow-lg">🎉</span>
        </div>
      )}
      
      <CardHeader className="pb-2 relative z-10">
        <div className="flex justify-between items-start">
          <h3 className="wedding-heading font-bold text-lg rainbow-header line-clamp-2 drop-shadow-sm">
            {event.title}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLike?.(event.id)}
            className="text-pink-500 hover:text-pink-600 hover:bg-pink-50 hover:scale-110 hover:rotate-12 transition-all duration-300 relative group/heart"
          >
            <Heart className="w-4 h-4 group-hover/heart:animate-pulse" />
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {event.tags.map((tag, index) => (
            <Badge 
              key={tag} 
              variant="outline" 
              className="text-xs border-pink-300 text-pink-600 hover:bg-gradient-to-r hover:from-pink-100 hover:to-purple-100 hover:border-purple-300 hover:text-purple-600 hover:scale-105 transition-all duration-300 cursor-pointer"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-0 relative z-10">
        <p className="text-gray-300 text-sm mb-4 line-clamp-2 group-hover:text-gray-200 transition-colors duration-300">
          {event.description}
        </p>

        <div className="space-y-3 mb-5">
          <div className="flex items-center text-sm text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
            <Calendar className="w-4 h-4 mr-3 text-pink-500 group-hover:text-purple-500 group-hover:scale-110 transition-all duration-300" />
            <span className="font-medium">{event.date} at {event.time}</span>
          </div>
          
          <div className="flex items-center text-sm text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
            <MapPin className="w-4 h-4 mr-3 text-pink-500 group-hover:text-purple-500 group-hover:scale-110 transition-all duration-300" />
            <span className="font-medium">{event.location}</span>
          </div>
          
          <div className="flex items-center text-sm text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
            <Users className="w-4 h-4 mr-3 text-pink-500 group-hover:text-purple-500 group-hover:scale-110 transition-all duration-300" />
            <span className="font-medium">{event.attendees}/{event.maxAttendees} attending</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3">
          <span className="text-sm text-gray-400 font-medium group-hover:text-gray-300 transition-colors duration-300">
            by {event.organizer}
          </span>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onInvite?.(event.id)}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Invite Friends
            </Button>

            <Button
              onClick={() => onJoin?.(event.id)}
              size="sm"
              className={`font-bold transition-all duration-300 hover:scale-105 hover:shadow-lg relative overflow-hidden group/btn ${
                event.isAttending
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                  : 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
              <span className="relative z-10">{event.isAttending ? 'Attending' : 'Join Event'}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventCard;
