import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { ShieldCheck, Users, MessageCircle, Sparkles, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type PublicReview = {
  id: string;
  author_name: string | null;
  message: string;
  kind: "review" | "complaint";
  created_at: string;
};

const LandingPreviewPage: React.FC = () => {
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "chava@violetsandvibes.com";
  const canonicalUrl = "https://www.violetsandvibes.com/";
  const shareMessage =
    "Violets & Vibes: a safer, women-centered space for meaningful connection.";
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [reviewKind, setReviewKind] = useState<"review" | "complaint">("review");
  const [publicReviews, setPublicReviews] = useState<PublicReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const { toast } = useToast();

  const buildGmailComposeUrl = (subject?: string, body?: string) => {
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: contactEmail,
    });
    if (subject) params.set("su", subject);
    if (body) params.set("body", body);
    return `https://mail.google.com/mail/?${params.toString()}`;
  };

  const openExternal = (url: string) => {
    try {
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (popup) return true;
      window.location.assign(url);
      return true;
    } catch {
      return false;
    }
  };

  const copyContactEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactEmail);
      toast({
        title: "Email copied",
        description: `Paste this address into your email app: ${contactEmail}`,
      });
    } catch {
      toast({
        title: "Could not open email",
        description: `Please email ${contactEmail} directly.`,
      });
    }
  };

  const openFeedbackEmail = async () => {
    const subject = feedbackName.trim()
      ? `Violets & Vibes feedback from ${feedbackName.trim()}`
      : "Violets & Vibes feedback";
    const body =
      feedbackMessage.trim() || "Hi, I wanted to share feedback/suggestions:";

    const opened = openExternal(buildGmailComposeUrl(subject, body));
    if (!opened) {
      await copyContactEmail();
      return;
    }

    toast({
      title: "Feedback draft opened",
      description: "Your message draft is ready to send.",
    });
  };

  const openDirectEmail = async () => {
    const opened = openExternal(
      buildGmailComposeUrl("Violets & Vibes support request")
    );
    if (!opened) {
      await copyContactEmail();
      return;
    }

    toast({
      title: "Email draft opened",
      description: "Compose your message and send it directly.",
    });
  };

  const loadPublicReviews = async () => {
    try {
      setReviewsLoading(true);
      setReviewsError(null);

      const { data, error } = await supabase
        .from("public_reviews")
        .select("id, author_name, message, kind, created_at")
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;
      setPublicReviews((data ?? []) as PublicReview[]);
    } catch (error: any) {
      console.error("Failed to load public reviews:", error);
      setReviewsError(error?.message || "Could not load community reviews.");
    } finally {
      setReviewsLoading(false);
    }
  };

  const submitPublicReview = async () => {
    const trimmedMessage = feedbackMessage.trim();
    const trimmedName = feedbackName.trim();

    if (trimmedMessage.length < 4) {
      toast({
        title: "Add more detail",
        description: "Please add at least a short review or complaint.",
      });
      return;
    }

    try {
      setSubmittingReview(true);
      const { data, error } = await supabase
        .from("public_reviews")
        .insert({
          author_name: trimmedName || null,
          message: trimmedMessage,
          kind: reviewKind,
        })
        .select("id, author_name, message, kind, created_at")
        .single();

      if (error) throw error;

      setPublicReviews((prev) => [data as PublicReview, ...prev]);
      setFeedbackMessage("");
      toast({
        title: reviewKind === "complaint" ? "Complaint posted" : "Review posted",
        description: "Your message is now visible to the community.",
      });
    } catch (error: any) {
      console.error("Failed to post public review:", error);
      toast({
        title: "Could not post",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    void loadPublicReviews();
  }, []);

  const handleShareSite = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Violets & Vibes",
          text: shareMessage,
          url: canonicalUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(`${shareMessage}\n${canonicalUrl}`);
      toast({
        title: "Link copied",
        description: "Share link copied to clipboard.",
      });
    } catch (error: any) {
      if (error?.name === "AbortError") return;

      toast({
        title: "Could not share automatically",
        description: canonicalUrl,
      });
    }
  };

  return (
    <div className="page-gradient min-h-screen relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-8 left-8 h-40 w-40 rounded-full bg-pink-400/18 sm:bg-pink-400/30 blur-3xl floating-orb" />
        <div
          className="absolute top-24 right-10 h-32 w-32 rounded-full bg-purple-400/18 sm:bg-purple-400/30 blur-2xl floating-orb"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute bottom-10 left-1/4 h-44 w-44 rounded-full bg-indigo-500/18 sm:bg-indigo-500/30 blur-3xl floating-orb"
          style={{ animationDelay: "3s" }}
        />
        <div
          className="absolute bottom-16 right-1/4 h-40 w-40 rounded-full bg-cyan-400/14 sm:bg-cyan-400/20 blur-3xl floating-orb"
          style={{ animationDelay: "2.2s" }}
        />
        <div
          className="absolute top-1/3 left-1/3 h-36 w-36 rounded-full bg-orange-300/12 sm:bg-orange-300/20 blur-3xl floating-orb"
          style={{ animationDelay: "4.1s" }}
        />
      </div>

      <div
        className="relative z-10 mx-auto max-w-6xl px-4 pb-6 sm:pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
        <header className="rounded-3xl border border-white/30 bg-gradient-to-br from-black/88 via-purple-950/55 to-pink-950/52 sm:from-black/80 sm:via-purple-950/70 sm:to-pink-950/65 p-5 sm:p-7 mb-6 sm:mb-8 backdrop-blur-xl shadow-2xl">
          <AnimatedLogo size="lg" className="mb-4" />
          <p className="text-3xl sm:text-4xl font-semibold text-white leading-tight max-w-3xl">
            A Safer Space for Women to Connect.
          </p>
          <p className="mt-3 text-white/85 max-w-3xl text-base sm:text-lg leading-relaxed">
            Violets &amp; Vibes is a protected, women-centered community where
            meaningful friendships, relationships, and real connection can grow
            without pressure, intrusion, or chaos.
          </p>
          <p className="mt-2 text-white/80 max-w-3xl">
            Inclusive of transgender women and non-binary individuals who align
            with a woman-centered space.
          </p>
          <p className="mt-4 text-pink-200 font-medium">
            Women-centered. Inclusive. Safety-first.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild className="btn-pride-celebrate">
              <Link to="/signin?redirect=%2Fsocial">Join the Community</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
            >
              <Link to="/signin?redirect=%2Fsocial">Sign In</Link>
            </Button>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              onClick={() => void handleShareSite()}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Violets &amp; Vibes
            </Button>
          </div>
        </header>

        <main className="space-y-5 sm:space-y-6">
          <section className="rounded-2xl border border-pink-200/30 bg-gradient-to-br from-pink-500/14 via-purple-600/14 to-indigo-600/12 sm:from-pink-500/22 sm:via-purple-600/22 sm:to-indigo-600/20 p-5 sm:p-6 backdrop-blur-lg shadow-2xl">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white">
              Because Women Deserve Better Online Spaces.
            </h2>
            <p className="mt-3 text-white/85 leading-relaxed">
              Too many platforms prioritize attention over authenticity.
            </p>
            <p className="mt-2 text-white/85 leading-relaxed">
              Violets &amp; Vibes was created intentionally, a space built for
              women who value respect, accountability, and genuine connection.
            </p>
            <p className="mt-3 text-white/80">
              Dating is welcome. Friendship is valued. Community is the
              foundation.
            </p>

            <div className="mt-4">
              <Button asChild className="btn-pride">
                <Link to="/signin?redirect=%2Fsocial">Create Your Profile</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-rose-300/35 bg-gradient-to-br from-rose-600/16 via-fuchsia-600/14 to-orange-500/12 sm:from-rose-600/25 sm:via-fuchsia-600/20 sm:to-orange-500/18 p-5 sm:p-6 shadow-2xl backdrop-blur-lg">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white">
              Protected. Intentional. Clear.
            </h2>
            <p className="mt-3 text-white/85 leading-relaxed">
              Violets &amp; Vibes is created exclusively for women, inclusive of
              transgender women and non-binary individuals who align with a
              woman-centered community.
            </p>
            <p className="mt-3 text-white/90 font-medium">
              This platform is not open to men or couples.
            </p>
            <p className="mt-2 text-white/80 leading-relaxed">
              It exists to provide women a space free from unwanted pressure,
              fetishization, and intrusion, where connection can happen safely
              and intentionally.
            </p>
            <p className="mt-3 text-pink-200 font-medium">Because women deserve that.</p>
          </section>

          <section className="rounded-2xl border border-pink-300/35 bg-gradient-to-r from-pink-600/18 via-purple-700/18 to-indigo-700/18 sm:from-pink-600/30 sm:via-purple-700/28 sm:to-indigo-700/28 p-4 sm:p-5 backdrop-blur-lg shadow-2xl">
            <p className="text-sm uppercase tracking-wide text-pink-200/90 font-semibold">
              Founder Note
            </p>
            <p className="mt-2 text-white/90 leading-relaxed">
              Violets &amp; Vibes was created intentionally to provide women a protected
              digital space. Thank you for helping shape a culture built on safety,
              respect, and meaningful connection.
            </p>
          </section>

          <section className="rounded-2xl border border-indigo-200/30 bg-gradient-to-br from-indigo-500/16 via-purple-600/15 to-cyan-500/12 sm:from-indigo-500/25 sm:via-purple-600/22 sm:to-cyan-500/18 p-5 sm:p-6 backdrop-blur-lg shadow-2xl">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white">
              What You&apos;ll Find Here
            </h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-pink-200/25 bg-gradient-to-br from-pink-500/8 to-purple-500/6 sm:from-pink-500/15 sm:to-purple-500/10 p-4">
                <div className="flex items-center gap-2 text-pink-200 font-semibold">
                  <Sparkles className="w-4 h-4" />
                  Intentional Connection
                </div>
                <p className="mt-2 text-white/80 text-sm">
                  Meet women who value communication, alignment, and shared
                  energy.
                </p>
              </div>

              <div className="rounded-xl border border-purple-200/25 bg-gradient-to-br from-purple-500/8 to-indigo-500/6 sm:from-purple-500/15 sm:to-indigo-500/10 p-4">
                <div className="flex items-center gap-2 text-purple-200 font-semibold">
                  <Users className="w-4 h-4" />
                  Inclusive Community
                </div>
                <p className="mt-2 text-white/80 text-sm">
                  All identities. All orientations. All welcome, within a
                  women-centered space.
                </p>
              </div>

              <div className="rounded-xl border border-blue-200/25 bg-gradient-to-br from-blue-500/8 to-cyan-500/6 sm:from-blue-500/15 sm:to-cyan-500/10 p-4">
                <div className="flex items-center gap-2 text-blue-200 font-semibold">
                  <MessageCircle className="w-4 h-4" />
                  Private Conversations
                </div>
                <p className="mt-2 text-white/80 text-sm">
                  Build trust at your own pace.
                </p>
              </div>

              <div className="rounded-xl border border-green-200/25 bg-gradient-to-br from-green-500/8 to-emerald-500/6 sm:from-green-500/15 sm:to-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-green-200 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  Safety First
                </div>
                <p className="mt-2 text-white/80 text-sm">
                  Respect is expected. Boundaries are honored. Accountability
                  matters.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/20 bg-gradient-to-r from-purple-900/55 via-fuchsia-900/52 to-indigo-900/55 sm:from-purple-900/70 sm:via-fuchsia-900/65 sm:to-indigo-900/70 p-5 sm:p-6 text-center backdrop-blur-lg shadow-2xl">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white">
              Connection Should Feel Safe.
            </h2>
            <p className="mt-3 text-white/85 max-w-3xl mx-auto leading-relaxed">
              Whether you&apos;re here for friendship, romance, conversation, or
              community, you deserve a space that feels aligned with your values.
            </p>
            <p className="mt-3 text-white/80">
              No chaos. No performance. No outside agendas.
            </p>
            <p className="mt-2 text-pink-200 font-medium">
              Just connection with intention.
            </p>
          </section>

          <section className="rounded-2xl border border-cyan-200/25 bg-gradient-to-br from-slate-900/92 via-purple-900/56 to-indigo-900/56 sm:from-slate-900/85 sm:via-purple-900/70 sm:to-indigo-900/70 p-5 sm:p-6 backdrop-blur-lg shadow-2xl">
            <h2 className="text-2xl sm:text-3xl font-semibold text-white">
              Comments, Suggestions, or Direct Contact
            </h2>
            <p className="mt-3 text-white/80">
              Have ideas, feedback, or a support request? Send a note directly.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={feedbackName}
                onChange={(e) => setFeedbackName(e.target.value)}
                placeholder="Your name (optional)"
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/55 outline-none focus:border-pink-300/60"
              />
              <div className="rounded-lg border border-white/20 bg-gradient-to-r from-purple-500/12 to-pink-500/12 sm:from-purple-500/20 sm:to-pink-500/20 px-3 py-2 text-white/90">
                Contact: {contactEmail}
              </div>
            </div>

            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="Share your comments or suggestions..."
              rows={4}
              className="mt-3 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/55 outline-none focus:border-pink-300/60"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReviewKind("review")}
                className={`rounded-full px-3 py-1 text-xs border ${
                  reviewKind === "review"
                    ? "bg-pink-500/30 border-pink-300/60 text-pink-100"
                    : "bg-white/10 border-white/25 text-white/80"
                }`}
              >
                Review
              </button>
              <button
                type="button"
                onClick={() => setReviewKind("complaint")}
                className={`rounded-full px-3 py-1 text-xs border ${
                  reviewKind === "complaint"
                    ? "bg-rose-500/30 border-rose-300/60 text-rose-100"
                    : "bg-white/10 border-white/25 text-white/80"
                }`}
              >
                Complaint
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => void submitPublicReview()}
                disabled={submittingReview}
              >
                {submittingReview ? "Posting..." : "Leave a Review"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => void openDirectEmail()}
              >
                Email Directly
              </Button>
              <Button type="button" onClick={() => void openFeedbackEmail()} className="btn-pride">
                Send Feedback
              </Button>
            </div>

            <div className="mt-5 rounded-xl border border-white/20 bg-white/5 p-3">
              <div className="text-white font-medium">Community Reviews & Complaints</div>
              {reviewsLoading ? (
                <div className="text-sm text-white/70 mt-2">Loading…</div>
              ) : reviewsError ? (
                <div className="text-sm text-rose-200 mt-2">{reviewsError}</div>
              ) : publicReviews.length === 0 ? (
                <div className="text-sm text-white/70 mt-2">No public reviews yet.</div>
              ) : (
                <div className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
                  {publicReviews.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-white/15 bg-black/20 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="text-white/90 font-medium truncate">
                          {item.author_name || "Community member"}
                        </div>
                        <div
                          className={`shrink-0 rounded-full px-2 py-0.5 border ${
                            item.kind === "complaint"
                              ? "border-rose-300/50 text-rose-200 bg-rose-500/20"
                              : "border-pink-300/50 text-pink-200 bg-pink-500/20"
                          }`}
                        >
                          {item.kind === "complaint" ? "Complaint" : "Review"}
                        </div>
                      </div>
                      <div className="text-sm text-white/85 mt-1 whitespace-pre-wrap">
                        {item.message}
                      </div>
                      <div className="text-[11px] text-white/55 mt-1">
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-pink-300/35 bg-gradient-to-r from-pink-500/22 via-purple-500/22 to-indigo-500/22 sm:from-pink-500/35 sm:via-purple-500/35 sm:to-indigo-500/35 p-5 sm:p-7 text-center shadow-2xl backdrop-blur-lg">
            <h2 className="text-3xl sm:text-4xl font-semibold text-white">
              Find Your People. Feel the Vibe.
            </h2>
            <p className="mt-3 text-white/85 max-w-3xl mx-auto">
              Join Violets &amp; Vibes and start building connections that feel
              real, respectful, and aligned.
            </p>
            <div className="mt-5">
              <Button asChild className="btn-pride-celebrate">
                <Link to="/signin?redirect=%2Fsocial">Join Violets &amp; Vibes</Link>
              </Button>
            </div>
          </section>
        </main>

        <footer className="mt-6 text-center text-sm text-white/70">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link className="hover:text-white underline underline-offset-4" to="/privacy">
              Privacy Policy
            </Link>
            <Link className="hover:text-white underline underline-offset-4" to="/terms">
              Terms of Service
            </Link>
            <Link className="hover:text-white underline underline-offset-4" to="/data-deletion">
              Data Deletion
            </Link>
            <a
              className="hover:text-white underline underline-offset-4"
              href={`mailto:${contactEmail}`}
            >
              Contact
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPreviewPage;
