import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, HeartHandshake, MessageCircleMore, PawPrint, Sparkles, Users, BookOpen, Mountain, Briefcase, Rainbow } from "lucide-react";

type Circle = {
  name: string;
  description: string;
  stats: {
    posts: number;
    meetups: number;
    chats: number;
    members: number;
  };
  icon: React.ReactNode;
  tone: string;
};

const circles: Circle[] = [
  {
    name: "Women Who Love Dogs",
    description: "Pup photos, dog-friendly meetups, and low-pressure connection.",
    stats: { posts: 128, meetups: 6, chats: 14, members: 412 },
    icon: <PawPrint className="h-4 w-4" />,
    tone: "from-amber-400/20 to-rose-400/10 border-amber-300/25",
  },
  {
    name: "Book Lovers",
    description: "Reading sprints, book swap threads, and cozy conversation starters.",
    stats: { posts: 96, meetups: 4, chats: 11, members: 263 },
    icon: <BookOpen className="h-4 w-4" />,
    tone: "from-emerald-400/20 to-sky-400/10 border-emerald-300/25",
  },
  {
    name: "Hiking Friends",
    description: "Trail plans, sunrise walks, and active women looking for real company.",
    stats: { posts: 83, meetups: 9, chats: 8, members: 305 },
    icon: <Mountain className="h-4 w-4" />,
    tone: "from-sky-400/20 to-indigo-400/10 border-sky-300/25",
  },
  {
    name: "Healing & Support",
    description: "Gentle check-ins, support posts, and community care without pressure.",
    stats: { posts: 151, meetups: 3, chats: 19, members: 341 },
    icon: <HeartHandshake className="h-4 w-4" />,
    tone: "from-pink-400/20 to-fuchsia-400/10 border-pink-300/25",
  },
  {
    name: "LGBTQ+ Pride Circle",
    description: "Shared identity, celebration, events, and safe queer community space.",
    stats: { posts: 174, meetups: 7, chats: 16, members: 518 },
    icon: <Rainbow className="h-4 w-4" />,
    tone: "from-fuchsia-400/20 to-indigo-400/10 border-fuchsia-300/25",
  },
  {
    name: "Entrepreneurs",
    description: "Ambitious women swapping wins, advice, intros, and accountability.",
    stats: { posts: 68, meetups: 5, chats: 10, members: 204 },
    icon: <Briefcase className="h-4 w-4" />,
    tone: "from-violet-400/20 to-cyan-400/10 border-violet-300/25",
  },
];

export const CommunityCirclesCard: React.FC = () => {
  return (
    <Card className="overflow-hidden border-white/15 bg-[linear-gradient(135deg,rgba(33,16,71,0.96),rgba(17,23,60,0.96))] text-white shadow-2xl">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-pink-300/25 bg-pink-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-pink-100">
              <Users className="h-3.5 w-3.5" />
              Community Circles
            </div>
            <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Dating + friendship + community
            </h3>
            <p className="mt-2 max-w-3xl text-sm sm:text-base text-white/75">
              Circles keep people engaged even when they do not match quickly. Each circle blends posts,
              meetups, chats, and member lists so the app keeps momentum through real community.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-pink-500 text-white hover:bg-pink-400">
              <Sparkles className="mr-2 h-4 w-4" />
              Create a Circle
            </Button>
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              Browse all Circles
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {circles.map((circle) => (
            <div
              key={circle.name}
              className={`rounded-[24px] border bg-gradient-to-br ${circle.tone} p-4 backdrop-blur-sm transition duration-200 hover:bg-white/10`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90">
                    {circle.icon}
                    Circle
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-white">{circle.name}</h4>
                  <p className="mt-2 text-sm text-white/72">{circle.description}</p>
                </div>
                <Badge className="border-white/15 bg-white/10 text-white">
                  {circle.stats.members} members
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-white/80">
                <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div className="flex items-center gap-2 text-white/65">
                    <MessageCircleMore className="h-4 w-4" />
                    Chats
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">{circle.stats.chats}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div className="flex items-center gap-2 text-white/65">
                    <CalendarDays className="h-4 w-4" />
                    Meetups
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">{circle.stats.meetups}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div className="flex items-center gap-2 text-white/65">
                    <Sparkles className="h-4 w-4" />
                    Posts
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">{circle.stats.posts}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div className="flex items-center gap-2 text-white/65">
                    <Users className="h-4 w-4" />
                    Member list
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">{circle.stats.members}</div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button className="flex-1 bg-white text-violet-950 hover:bg-white/90">
                  Join Circle
                </Button>
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  Open
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CommunityCirclesCard;
