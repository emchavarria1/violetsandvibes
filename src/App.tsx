import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import AppPreferencesBootstrapper from "@/components/AppPreferencesBootstrapper";
import { GlobalLayout } from "@/components/GlobalLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProfileGate } from "@/components/ProfileGate";
import { VerificationGate } from "@/components/VerificationGate";
import Index from "./pages/Index";
import HeroesPage from "./pages/HeroesPage";
import SignInPage from "./pages/SignInPage";
import NotFound from "./pages/NotFound";
const MatchesPage = lazy(() => import("./pages/MatchesPage"));
const SocialPage = lazy(() => import("./pages/SocialPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const VideoPage = lazy(() => import("./pages/VideoPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));
const FiltersPage = lazy(() => import("./pages/FiltersPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ProfileCreationFlow = lazy(() => import("@/components/ProfileCreationFlow"));
const ProfileEditPage = lazy(() => import("./pages/ProfileEditPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const LandingPreviewPage = lazy(() => import("./pages/LandingPreviewPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const DataDeletionPage = lazy(() => import("./pages/DataDeletionPage"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="page-calm min-h-screen flex items-center justify-center px-4">
    <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white/80 backdrop-blur-md">
      Loading...
    </div>
  </div>
);

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <AppPreferencesBootstrapper />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/landing-preview" element={<LandingPreviewPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/data-deletion" element={<DataDeletionPage />} />
              <Route path="/" element={<HeroesPage />} />
              <Route
                path="/discover"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><Index /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route path="/heroes" element={<HeroesPage />} />
              <Route
                path="/matches"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><MatchesPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/social"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><SocialPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><ChatPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/video"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><VideoPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/events"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><EventsPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><EventsPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><NotificationsPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/verification"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <GlobalLayout><VerificationPage /></GlobalLayout>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/filters"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><FiltersPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><ProfilePage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile/:id"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><ProfilePage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/create-new-profile"
                element={
                  <ProtectedRoute>
                    <ProfileCreationFlow />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/edit-profile"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><ProfileEditPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <GlobalLayout><AdminPage /></GlobalLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscription"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><SubscriptionPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <ProfileGate>
                      <VerificationGate>
                        <GlobalLayout><SettingsPage /></GlobalLayout>
                      </VerificationGate>
                    </ProfileGate>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<GlobalLayout><NotFound /></GlobalLayout>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
