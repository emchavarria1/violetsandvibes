import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Gift, Share2, ShieldCheck, Sparkles, Users } from "lucide-react";

const inviteUrl = "https://violetsandvibes.com/signin";

const rewardItems = [
  "3 SuperLikes",
  "24-hour profile boost",
  "Trusted circle badge",
];

export const WomenInviteWomenCard: React.FC = () => {
  const { toast } = useToast();

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "Invite link copied",
        description: "Share it with women you trust.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy the invite link right now.",
        variant: "destructive",
      });
    }
  };

  const handleShareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Violets & Vibes",
          text: "Help build a safe community. Invite 3 women you trust.",
          url: inviteUrl,
        });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }

    await handleCopyInvite();
  };

  return (
    <section className="mb-5 overflow-hidden rounded-[30px] border border-rose-200/25 bg-gradient-to-r from-rose-500/20 via-fuchsia-500/10 to-indigo-500/20 p-[1px] shadow-2xl">
      <div className="relative rounded-[28px] border border-white/15 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.25),_transparent_35%),linear-gradient(135deg,rgba(22,8,44,0.98),rgba(38,13,69,0.96)_48%,rgba(20,19,58,0.96))] p-5 sm:p-6">
        <div className="pointer-events-none absolute -top-12 right-0 h-36 w-36 rounded-full bg-pink-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-0 h-32 w-32 rounded-full bg-indigo-400/15 blur-3xl" />

        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trust Growth Loop
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
            <div>
              <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                Women Invite Women
              </h3>
              <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/85">
                Help build a safe community. Invite 3 women you trust.
              </p>
              <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/70">
                Safe communities grow through trusted networks, not ads. One member invites three women,
                those women invite three more, and the circle grows with trust built in.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {rewardItems.map((reward) => (
                  <Badge
                    key={reward}
                    className="border border-pink-300/35 bg-pink-400/15 px-3 py-1 text-pink-50"
                  >
                    <Gift className="mr-1.5 h-3.5 w-3.5" />
                    {reward}
                  </Badge>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => void handleShareInvite()}
                  className="bg-pink-500 text-white hover:bg-pink-400"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Invite 3 Women
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleCopyInvite()}
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Invite Link
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
                <Users className="h-4 w-4 text-pink-300" />
                Why it grows
              </div>
              <div className="space-y-3 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                  User joins
                </div>
                <div className="flex items-center gap-2 text-pink-200">
                  <Sparkles className="h-4 w-4" />
                  invites 3 trusted friends
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                  Those friends invite 3 more
                </div>
                <div className="text-white/65">
                  Exponential growth, but through trusted networks instead of cold acquisition.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WomenInviteWomenCard;
