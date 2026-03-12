import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PrivacyPolicyPage: React.FC = () => {
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "contactus@violetsandvibes.com";

  return (
    <div className="page-gradient min-h-screen relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-10 h-32 w-32 rounded-full bg-pink-400/25 blur-3xl" />
        <div className="absolute top-24 right-12 h-28 w-28 rounded-full bg-violet-400/25 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <div className="rounded-3xl border border-white/25 bg-black/55 p-5 sm:p-7 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl sm:text-4xl font-semibold text-white">Privacy Policy</h1>
            <Button asChild variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <Link to="/signin">Back to Sign In</Link>
            </Button>
          </div>
          <p className="mt-3 text-white/80 text-sm">Last updated: February 26, 2026</p>
          <p className="mt-4 text-white/85">
            Violets &amp; Vibes values privacy, consent, and safety. This policy explains what we
            collect, why we collect it, and the choices you have.
          </p>

          <div className="mt-6 space-y-5 text-white/85">
            <section>
              <h2 className="text-xl text-white font-semibold">Information We Collect</h2>
              <p className="mt-2">
                We collect account details (email, profile info), content you share (photos, posts,
                messages, verification uploads), and technical usage data needed to secure and
                operate the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">How We Use Information</h2>
              <p className="mt-2">
                We use data to run core features, improve matching and safety systems, process
                verification, prevent abuse, and provide support.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">Sharing</h2>
              <p className="mt-2">
                We do not sell personal data. Data may be shared only with trusted infrastructure
                providers or where legally required.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">Retention and Security</h2>
              <p className="mt-2">
                We retain information only as needed for service, safety, and legal obligations.
                Security controls are applied to protect account and content data.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">Your Choices</h2>
              <p className="mt-2">
                You can update profile details, manage preferences, and request account deletion from
                Settings. You may also contact us for privacy requests.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">Contact</h2>
              <p className="mt-2">
                Privacy questions:{" "}
                <a className="text-pink-200 underline" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
