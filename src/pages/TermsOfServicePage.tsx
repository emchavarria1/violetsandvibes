import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TermsOfServicePage: React.FC = () => {
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "contactus@violetsandvibes.com";

  return (
    <div className="page-gradient min-h-screen relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-14 left-12 h-32 w-32 rounded-full bg-indigo-400/25 blur-3xl" />
        <div className="absolute top-24 right-16 h-28 w-28 rounded-full bg-pink-400/25 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <div className="rounded-3xl border border-white/25 bg-black/55 p-5 sm:p-7 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl sm:text-4xl font-semibold text-white">Terms of Service</h1>
            <Button asChild variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <Link to="/signin">Back to Sign In</Link>
            </Button>
          </div>
          <p className="mt-3 text-white/80 text-sm">Last updated: February 26, 2026</p>
          <p className="mt-4 text-white/85">
            These terms govern use of Violets &amp; Vibes. By accessing the service, users agree to
            these terms.
          </p>

          <div className="mt-6 space-y-5 text-white/85">
            <section>
              <h2 className="text-xl text-white font-semibold">Eligibility and Accounts</h2>
              <p className="mt-2">
                Users must meet legal age requirements in their region and provide accurate account
                information. Users are responsible for account security.
              </p>
            </section>

            <section id="community-standards">
              <h2 className="text-xl text-white font-semibold">Safety / Community Standards</h2>
              <p className="mt-2">
                Harassment, hate, impersonation, exploitation, non-consensual content, and safety
                violations are prohibited. Accounts may be restricted or removed for violations.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">User Content</h2>
              <p className="mt-2">
                Users keep ownership of submitted content. By posting, users grant a limited license
                for hosting, display, moderation, and core service operation.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">Verification and Safety Features</h2>
              <p className="mt-2">
                Verification tools support trust and safety but do not guarantee identity in all
                cases. Users should continue to apply personal safety judgment.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">Termination</h2>
              <p className="mt-2">
                Users may stop using the service at any time. We may suspend or terminate access for
                term violations, abuse, fraud, or legal compliance needs.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">Contact</h2>
              <p className="mt-2">
                Terms questions:{" "}
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

export default TermsOfServicePage;
