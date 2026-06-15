import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { getSessionId } from "@/lib/session";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { StudyModeProvider } from "./contexts/StudyModeContext";

/**
 * Fires a single `session_start` event per page-load so the pilot can count
 * sessions and unique users. Best-effort — failures are ignored.
 */
function SessionTracker() {
  const logEvent = trpc.events.logEvent.useMutation();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    logEvent.mutate({
      sessionId: getSessionId(),
      type: "session_start",
      data: {
        userAgent: navigator.userAgent,
        path: window.location.pathname,
        referrer: document.referrer || null,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
import Verifier from "./pages/Verifier";
import Visualizer from "./pages/Visualizer";
import Welcome from "./pages/Welcome";
import StudyResults from "./pages/StudyResults";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Welcome} />
      <Route path={"/visualizer"} component={Visualizer} />
      <Route path={"/verifier"} component={Verifier} />
      <Route path={"/study-results"} component={StudyResults} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <StudyModeProvider>
          <TooltipProvider>
            <Toaster />
            <SessionTracker />
            <Router />
          </TooltipProvider>
        </StudyModeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
