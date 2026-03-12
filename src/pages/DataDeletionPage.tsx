import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const DataDeletionPage: React.FC = () => {
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "contactus@violetsandvibes.com";

  return (
    <div className="page-gradient min-h-screen relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-10 h-32 w-32 rounded-full bg-rose-400/25 blur-3xl" />
        <div className="absolute top-24 right-14 h-28 w-28 rounded-full bg-sky-400/25 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <div className="rounded-3xl border border-white/25 bg-black/55 p-5 sm:p-7 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl sm:text-4xl font-semibold text-white">User Data Deletion</h1>
            <Button asChild variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <Link to="/signin">Back to Sign In</Link>
            </Button>
          </div>
          <p className="mt-3 text-white/80 text-sm">Last updated: February 26, 2026</p>

          <div className="mt-6 space-y-5 text-white/85">
            <section>
              <h2 className="text-xl text-white font-semibold">How to Request Deletion</h2>
              <p className="mt-2">
                You can request deletion of your Violets &amp; Vibes data in either of these ways:
              </p>
              <ol className="mt-3 list-decimal pl-5 space-y-2">
                <li>
                  In-app: open <strong>Settings</strong> and use <strong>Delete Account</strong>.
                </li>
                <li>
                  Email us at{" "}
                  <a className="text-pink-200 underline" href={`mailto:${contactEmail}`}>
                    {contactEmail}
                  </a>{" "}
                  from the email address tied to your account.
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">What Gets Deleted</h2>
              <p className="mt-2">
                Account profile data, photos, posts, likes/matches data, and related content are
                scheduled for deletion from production systems, subject to legal and safety retention
                requirements.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">Timeline</h2>
              <p className="mt-2">
                Deletion requests are processed as quickly as possible. Some backup systems may retain
                encrypted copies for a limited period before full expiration.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-semibold">Verification</h2>
              <p className="mt-2">
                For security, we may request confirmation that you own the account before fulfilling a
                deletion request.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataDeletionPage;
