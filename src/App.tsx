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

import MatchesPage from "./pages/MatchesPage";
import SocialPage from "./pages/SocialPage";
import ChatPage from "./pages/ChatPage";
import VideoPage from "./pages/VideoPage";
import EventsPage from "./pages/EventsPage";
import NotificationsPage from "./pages/NotificationsPage";
import VerificationPage from "./pages/VerificationPage";
import FiltersPage from "./pages/FiltersPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import ProfileCreationFlow from "@/components/ProfileCreationFlow";
import ProfileEditPage from "./pages/ProfileEditPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import SettingsPage from "./pages/SettingsPage";
import LandingPreviewPage from "./pages/LandingPreviewPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import DataDeletionPage from "./pages/DataDeletionPage";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <AppPreferencesBootstrapper />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
