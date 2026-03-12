import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface LifestyleStepProps {
  profile: any;
  onUpdate: (updates: any) => void;
}

const LifestyleStep: React.FC<LifestyleStepProps> = ({ profile, onUpdate }) => {
  const { t } = useI18n();
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [openCustomFor, setOpenCustomFor] = useState<string | null>(null);

  const lifestyleCategories = [
    {
      title: 'Relationship',
      options: ['Monogamous', 'Polyamorous', 'Open to both', 'Exploring']
    },
    {
      title: 'Family',
      options: ['Lives with family', 'Has roommates', 'Doesn\'t want children', 'Wants children']
    },
    {
      title: 'Children',
      options: ['Has children', 'Wants children', 'Doesn\'t want children', 'Open to children']
    },
    {
      title: 'Substances',
      options: ['Drinks socially', 'Doesn\'t drink', 'Sober', 'Sober friendly']
    },
    {
      title: 'Spirituality',
      options: ['Spiritual', 'Religious', 'Atheist', 'Agnostic']
    },
    {
      title: 'Wellness',
      options: ['Fitness enthusiast', 'Yoga lover', 'Mental health advocate', 'Meditation practitioner']
    },
    {
      title: 'Interests & Hobbies',
      options: ['Photography', 'Painting', 'Writing', 'Music', 'Dancing', 'Crafting', 'Cooking', 'Theater', 'Poetry', 'Zines']
    },
    {
      title: 'Active',
      options: ['Hiking', 'Yoga', 'Running', 'Swimming', 'Cycling', 'Rock climbing', 'Team sports', 'Roller derby', 'Softball']
    },
    {
      title: 'Entertainment',
      options: ['Gaming', 'Movies', 'TV shows', 'Concerts', 'Comedy shows', 'Board games', 'Drag shows', 'Queer cinema']
    },
    {
      title: 'Learning',
      options: ['Reading', 'Languages', 'Cooking', 'History', 'Science', 'Philosophy', 'Documentaries']
    },
    {
      title: 'Social',
      options: ['Going out', 'Coffee dates', 'Parties', 'Volunteering', 'Networking', 'Pride events', 'Queer meetups']
    },
    {
      title: 'Community',
      options: ['LGBTQ+ organizing', 'Community organizing', 'Mutual aid', 'Mentoring', 'Support groups', 'Political engagement', 'Social justice']
    }
  ];

  const categoryKey = (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

  const getCustomOptions = (key: string): string[] => {
    const currentLifestyle = profile.lifestyle || {};
    const raw = currentLifestyle[`${key}_custom_options`];
    if (!Array.isArray(raw)) return [];
    return raw.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0);
  };

  const ensureSelected = (category: string, interest: string) => {
    const currentInterests: string[] = Array.isArray(profile.interests) ? profile.interests : [];
    const interestKey = `${category}:${interest}`;
    const nextInterests = currentInterests.includes(interestKey)
      ? currentInterests
      : [...currentInterests, interestKey];

    const currentLifestyle = profile.lifestyle || {};
    const categoryInterests: string[] = Array.isArray(currentLifestyle[category])
      ? currentLifestyle[category]
      : [];
    const nextCategoryInterests = categoryInterests.includes(interest)
      ? categoryInterests
      : [...categoryInterests, interest];

    onUpdate({
      interests: nextInterests,
      lifestyle: {
        ...currentLifestyle,
        [category]: nextCategoryInterests,
      },
    });
  };

  const toggleInterest = (category: string, interest: string) => {
    const currentInterests: string[] = Array.isArray(profile.interests) ? profile.interests : [];
    const interestKey = `${category}:${interest}`;

    const currentLifestyle = profile.lifestyle || {};
    const categoryInterests: string[] = Array.isArray(currentLifestyle[category])
      ? currentLifestyle[category]
      : [];

    const isSelected = currentInterests.includes(interestKey);
    const nextInterests = isSelected
      ? currentInterests.filter((i: string) => i !== interestKey)
      : [...currentInterests, interestKey];
    const nextCategoryInterests = isSelected
      ? categoryInterests.filter((i: string) => i !== interest)
      : [...categoryInterests, interest];

    onUpdate({
      interests: nextInterests,
      lifestyle: {
        ...currentLifestyle,
        [category]: nextCategoryInterests,
      },
    });
  };

  const addCustomOption = (categoryTitle: string, options: string[]) => {
    const key = categoryKey(categoryTitle);
    const rawValue = customInputs[key] ?? '';
    const value = rawValue.replace(/\s+/g, ' ').trim();
    if (!value) return;

    const builtInSet = new Set(options.map((option) => normalize(option)));
    const currentCustomOptions = getCustomOptions(key);
    const customSet = new Set(currentCustomOptions.map((option) => normalize(option)));
    const currentLifestyle = profile.lifestyle || {};

    const nextCustomOptions =
      builtInSet.has(normalize(value)) || customSet.has(normalize(value))
        ? currentCustomOptions
        : [...currentCustomOptions, value];

    onUpdate({
      lifestyle: {
        ...currentLifestyle,
        [`${key}_custom_options`]: nextCustomOptions,
      },
    });

    ensureSelected(categoryTitle, value);
    setCustomInputs((prev) => ({ ...prev, [key]: '' }));
    setOpenCustomFor(null);
  };

  const removeCustomOption = (categoryTitle: string, optionToRemove: string) => {
    const key = categoryKey(categoryTitle);
    const currentLifestyle = profile.lifestyle || {};
    const currentInterests: string[] = Array.isArray(profile.interests) ? profile.interests : [];
    const currentCategoryInterests: string[] = Array.isArray(currentLifestyle[categoryTitle])
      ? currentLifestyle[categoryTitle]
      : [];
    const currentCustomOptions = getCustomOptions(key);
    const normalizedTarget = normalize(optionToRemove);

    const nextCustomOptions = currentCustomOptions.filter(
      (option) => normalize(option) !== normalizedTarget
    );
    const nextCategoryInterests = currentCategoryInterests.filter(
      (option) => normalize(option) !== normalizedTarget
    );
    const nextInterests = currentInterests.filter(
      (interestKey) => normalize(interestKey) !== normalize(`${categoryTitle}:${optionToRemove}`)
    );

    onUpdate({
      interests: nextInterests,
      lifestyle: {
        ...currentLifestyle,
        [categoryTitle]: nextCategoryInterests,
        [`${key}_custom_options`]: nextCustomOptions,
      },
    });
  };

  return (
    <div className="space-y-6">
        <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">{t('lifestyleAndValues')}</h2>
        <p className="text-sm text-white/70">{t('shareWhatMattersToYou')}</p>
      </div>

      {lifestyleCategories.map((category) => {
        const key = categoryKey(category.title);
        const customOptions = getCustomOptions(key);
        const optionSet = new Set(category.options.map((option) => normalize(option)));
        const mergedOptions = [
          ...category.options,
          ...customOptions.filter((option) => !optionSet.has(normalize(option))),
        ];

        return (
        <div key={category.title}>
          <h3 className="font-semibold mb-3">{category.title}</h3>
          <div className="grid grid-cols-2 gap-2">
            {mergedOptions.map((option) => {
              const interestKey = `${category.title}:${option}`;
              const isSelected = profile.interests?.includes(interestKey);
              
              return (
                <Button
                  key={option}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  className="justify-start text-sm"
                  onClick={() => toggleInterest(category.title, option)}
                >
                  {option}
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-2 text-sm"
            onClick={() => setOpenCustomFor((prev) => (prev === key ? null : key))}
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('addCustomCategory', { category: category.title })}
          </Button>
          {openCustomFor === key && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                value={customInputs[key] ?? ''}
                onChange={(e) =>
                  setCustomInputs((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={t('addCustomCategoryPlaceholder', { category: category.title.toLowerCase() })}
                className="bg-black/20 border-white/25 text-white placeholder:text-white/50"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => addCustomOption(category.title, category.options)}
                disabled={!(customInputs[key] ?? '').trim()}
              >
                {t('addAction')}
              </Button>
            </div>
          )}
          {customOptions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {customOptions.map((option) => (
                <div
                  key={`${key}-custom-chip-${option}`}
                  className="inline-flex items-center rounded-full border border-white/25 bg-white/5 px-3 py-1 text-xs text-white/85"
                >
                  <span>{option}</span>
                  <button
                    type="button"
                    className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-white/70 hover:bg-white/15 hover:text-white"
                    onClick={() => removeCustomOption(category.title, option)}
                    aria-label={t('removeCustomOption', { category: category.title, option })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )})}
    </div>
  );
};

export { LifestyleStep };
export default LifestyleStep;
