import React from 'react';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { useI18n } from '@/lib/i18n';

const INTERESTS = [
  // LGBTQ+ & Activism
  'LGBTQ+ Activism', 'Social Justice', 'Pride Events', 'Queer History', 'Community Organizing',
  'Feminism', 'Intersectionality', 'Trans Rights', 'Drag Shows', 'Queer Literature',
  
  // Arts & Culture
  'Photography', 'Art', 'Painting', 'Drawing', 'Sculpture', 'Poetry', 'Creative Writing',
  'Theater', 'Film', 'Music', 'Concerts', 'Dancing', 'Singing', 'Crafting',
  
  // Wellness & Fitness
  'Yoga', 'Meditation', 'Pilates', 'Rock Climbing', 'Hiking', 'Running', 'Cycling',
  'Swimming', 'Martial Arts', 'Weightlifting', 'Mental Health', 'Therapy',
  
  // Lifestyle & Hobbies
  'Cooking', 'Baking', 'Gardening', 'Reading', 'Gaming', 'Board Games', 'Puzzles',
  'Knitting', 'Sewing', 'DIY Projects', 'Home Decor', 'Fashion', 'Makeup',
  
  // Social & Community
  'Coffee Dates', 'Wine Tasting', 'Karaoke', 'Trivia Nights', 'Book Clubs',
  'Support Groups', 'Volunteering', 'Mentoring', 'Networking', 'Dating',
  
  // Professional & Education
  'Entrepreneurship', 'Tech', 'Science', 'Teaching', 'Healthcare', 'Law',
  'Non-profit Work', 'Academia', 'Research'
];

interface InterestsSelectorProps {
  selectedInterests: string[];
  onSelectionChange: (interests: string[]) => void;
  maxSelections?: number;
}

export const InterestsSelector: React.FC<InterestsSelectorProps> = ({
  selectedInterests,
  onSelectionChange,
  maxSelections = 10
}) => {
  const { t } = useI18n();
  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      onSelectionChange(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < maxSelections) {
      onSelectionChange([...selectedInterests, interest]);
    }
  };

  return (
    <Card className="p-4 glass-card">
      <h3 className="text-lg font-semibold mb-4 text-white">{t('interestsLabel')}</h3>
      <p className="text-sm text-gray-300 mb-4">{t('selectUpToInterests', { count: maxSelections })}</p>
      <div className="flex flex-wrap gap-2">
        {INTERESTS.map((interest) => {
          const isSelected = selectedInterests.includes(interest);
          return (
            <Badge
              key={interest}
              variant={isSelected ? "default" : "outline"}
              className={`cursor-pointer transition-all duration-200 ${
                isSelected 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent' 
                  : 'border-purple-300 text-purple-300 hover:border-pink-400 hover:text-pink-400'
              }`}
              onClick={() => toggleInterest(interest)}
            >
              {interest}
            </Badge>
          );
        })}
      </div>
    </Card>
  );
};

export default InterestsSelector;
