import { Switch, Route, Router, useLocation, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { IndustryProvider } from "@/contexts/IndustryContext";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Bookings from "@/pages/Bookings";
import Clients from "@/pages/Clients";
import AiFrontDesk from "@/pages/AiFrontDesk";
import PhoneReceptionist from "@/pages/PhoneReceptionist";
import SocialStudio from "@/pages/SocialStudio";
import Leads from "@/pages/Leads";
import Quotes from "@/pages/Quotes";
import Consent from "@/pages/Consent";
import Settings from "@/pages/Settings";
import ConsentPublic from "@/pages/ConsentPublic";
import Manuals from "@/pages/Manuals";
import BusinessInfo from "@/pages/BusinessInfo";
import Photos from "@/pages/Photos";
import Invoices from "@/pages/Invoices";
import Team from "@/pages/Team";
import ClientPortal from "@/pages/ClientPortal";
import Videos from "@/pages/Videos";
import Packages from "@/pages/Packages";
import Pricing from "@/pages/Pricing";
import CpdLog from "@/pages/CpdLog";
import Locations from "@/pages/Locations";
import Stock from "@/pages/Stock";
import Safi from "@/pages/Safi";
import SafiMemory from "@/pages/SafiMemory";
import WhatsApp from "@/pages/WhatsApp";
import SetupAssistant from "@/pages/SetupAssistant";
import NotFound from "@/pages/not-found";
import { SaffiVoiceConversation } from "@/components/SaffiVoiceConversation";

function Protected({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [setupChecked, setSetupChecked] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupIndustry, setSetupIndustry] = useState<string | undefined>(undefined);
  const [voiceOpen, setVoiceOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setVoiceOpen(true);
    const onClose = () => setVoiceOpen(false);
    window.addEventListener("saffi:openVoice", onOpen);
    window.addEventListener("saffi:closeVoice", onClose);
    return () => {
      window.removeEventListener("saffi:openVoice", onOpen);
      window.removeEventListener("saffi:closeVoice", onClose);
    };
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      navigate("/login");
    }
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!session || !user || setupChecked) return;
    supabase
      .from("users")
      .select("setup_complete, industry")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setSetupChecked(true);
        if (data && !data.setup_complete) {
          setSetupIndustry(data.industry ?? undefined);
          setShowSetup(true);
        }
      });
  }, [session, user, setupChecked]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      <AppShell>{children}</AppShell>
      {showSetup && (
        <SetupAssistant
          initialIndustry={setupIndustry}
          onComplete={() => setShowSetup(false)}
        />
      )}
      <SaffiVoiceConversation
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
      />
    </>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/consent/public/:token">
        {(params) => <ConsentPublic token={params.token} />}
      </Route>
      <Route path="/portal/:token">
        {(params) => <ClientPortal token={params.token} />}
      </Route>
      <Route path="/pricing" component={Pricing} />

      <Route path="/">
        <Protected>
          <Redirect to="/dashboard" />
        </Protected>
      </Route>
      <Route path="/dashboard">
        <Protected>
          <Dashboard />
        </Protected>
      </Route>
      <Route path="/bookings">
        <Protected>
          <Bookings />
        </Protected>
      </Route>
      <Route path="/clients">
        <Protected>
          <Clients />
        </Protected>
      </Route>
      <Route path="/ai-front-desk">
        <Protected>
          <AiFrontDesk />
        </Protected>
      </Route>
      <Route path="/phone-receptionist">
        <Protected>
          <PhoneReceptionist />
        </Protected>
      </Route>
      <Route path="/social-studio">
        <Protected>
          <SocialStudio />
        </Protected>
      </Route>
      <Route path="/leads">
        <Protected>
          <Leads />
        </Protected>
      </Route>
      <Route path="/quotes">
        <Protected>
          <Quotes />
        </Protected>
      </Route>
      <Route path="/consent">
        <Protected>
          <Consent />
        </Protected>
      </Route>
      <Route path="/settings">
        <Protected>
          <Settings />
        </Protected>
      </Route>
      <Route path="/team">
        <Protected>
          <Team />
        </Protected>
      </Route>
      <Route path="/invoices">
        <Protected>
          <Invoices />
        </Protected>
      </Route>
      <Route path="/photos">
        <Protected>
          <Photos />
        </Protected>
      </Route>
      <Route path="/business-info">
        <Protected>
          <BusinessInfo />
        </Protected>
      </Route>
      <Route path="/manuals">
        <Protected>
          <Manuals />
        </Protected>
      </Route>
      <Route path="/videos">
        <Protected>
          <Videos />
        </Protected>
      </Route>
      <Route path="/packages">
        <Protected>
          <Packages />
        </Protected>
      </Route>
      <Route path="/cpd">
        <Protected>
          <CpdLog />
        </Protected>
      </Route>
      <Route path="/locations">
        <Protected>
          <Locations />
        </Protected>
      </Route>
      <Route path="/stock">
        <Protected>
          <Stock />
        </Protected>
      </Route>
      <Route path="/whatsapp">
        <Protected>
          <WhatsApp />
        </Protected>
      </Route>
      <Route path="/safi">
        <Protected>
          <Safi />
        </Protected>
      </Route>
      <Route path="/safi-memory">
        <Protected>
          <SafiMemory />
        </Protected>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <IndustryProvider>
          <TooltipProvider>
            <Toaster />
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </TooltipProvider>
        </IndustryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
