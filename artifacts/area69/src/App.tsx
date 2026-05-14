import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/StoreContext";
import { I18nProvider } from "@/lib/I18nContext";
import { isAuthenticated } from "@/lib/store";
import FloatingSupport from "@/components/FloatingSupport";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import Dashboard from "@/pages/Dashboard";
import Models from "@/pages/Models";
import GenerateImage from "@/pages/GenerateImage";
import GenerateVideo from "@/pages/GenerateVideo";
import GenerateCharacter from "@/pages/GenerateHiggsfield";
import History from "@/pages/History";
import Settings from "@/pages/Settings";
import Billing from "@/pages/Billing";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (!isAuthenticated()) return <Redirect to="/sign-in" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/sign-up" component={SignUp} />
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/dashboard/models">{() => <ProtectedRoute component={Models} />}</Route>
      <Route path="/dashboard/generate">{() => <ProtectedRoute component={GenerateImage} />}</Route>
      <Route path="/dashboard/video">{() => <ProtectedRoute component={GenerateVideo} />}</Route>
      <Route path="/dashboard/character">{() => <ProtectedRoute component={GenerateCharacter} />}</Route>
      <Route path="/dashboard/higgsfield">{() => <Redirect to={`/dashboard/character${window.location.search}`} />}</Route>
      <Route path="/dashboard/history">{() => <ProtectedRoute component={History} />}</Route>
      <Route path="/dashboard/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route path="/dashboard/billing">{() => <ProtectedRoute component={Billing} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <FloatingSupport />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </StoreProvider>
    </I18nProvider>
  );
}

export default App;
