import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { FocusTimerProvider } from "../contexts/FocusTimerContext";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import katexCss from "katex/dist/katex.min.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppLayout } from "../components/AppLayout";
import { TutorialProvider } from "../components/TutorialProvider";
import { TutorialOverlay } from "../components/TutorialOverlay";
import { HelpButton } from "../components/HelpButton";
import { useTheme } from "../hooks/use-theme";
import { useAccent } from "../hooks/use-accent";
import { AuthProvider } from "../contexts/AuthContext";
import { LegalFooter } from "../components/LegalFooter";
import { LEGAL_PATHS } from "../lib/legal";
import { userErrorMessage } from "../lib/user-error";

const SITE_ORIGIN = new URL(import.meta.env.VITE_SITE_URL || "https://study-buddy.sitenova.dev")
  .origin;
const SOCIAL_IMAGE = `${SITE_ORIGIN}/og-study-buddy.png`;
const SOCIAL_DESCRIPTION =
  "Plan your prep, learn with AI, and practice with purpose. Your study tools, together in Study Buddy.";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {userErrorMessage(error, "This page couldn't load. Try again or head back home.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#3b82f6" },
      { title: "Study Buddy — Ace any competitive exam with AI" },
      {
        name: "description",
        content:
          "Your AI-powered competitive exam prep platform. Mock tests, AI tutor, syllabus tracking, analytics and more — for JEE, NEET, SAT, GRE & beyond.",
      },
      { name: "author", content: "Study Buddy" },
      { property: "og:title", content: "Study Buddy — Big exam goals. Better study days." },
      {
        property: "og:description",
        content: SOCIAL_DESCRIPTION,
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Study Buddy" },
      { property: "og:url", content: `${SITE_ORIGIN}/landing` },
      { property: "og:image", content: SOCIAL_IMAGE },
      { property: "og:image:secure_url", content: SOCIAL_IMAGE },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content:
          "Study Buddy — Big exam goals. Better study days. AI tutoring, study plans and sourced practice.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Study Buddy — Big exam goals. Better study days." },
      { name: "twitter:description", content: SOCIAL_DESCRIPTION },
      { name: "twitter:image", content: SOCIAL_IMAGE },
      {
        name: "twitter:image:alt",
        content: "Study Buddy: AI tutoring, study plans and sourced practice.",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/study-buddy-mark.svg",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap",
      },
      {
        rel: "stylesheet",
        href: katexCss,
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isNotFound = useRouterState({
    select: (s) => s.matches.some((match) => match.status === "notFound" || match.globalNotFound),
  });
  const isAuthPage =
    isNotFound ||
    path === "/login" ||
    path === "/admin" ||
    path === "/onboarding" ||
    path === "/landing" ||
    LEGAL_PATHS.includes(path.replace(/\/$/, ""));
  const { effectiveTheme } = useTheme();
  useAccent();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* FocusTimerProvider is inside QueryClientProvider (needs useMutation) and above
          the router outlet so the countdown survives navigation between routes. */}
        <FocusTimerProvider>
          <TutorialProvider>
            {isAuthPage ? <Outlet /> : <AppLayout />}
            {isAuthPage && <LegalFooter />}
            {!isAuthPage && (
              <>
                <TutorialOverlay />
                <HelpButton />
              </>
            )}
            <Toaster richColors position="top-right" theme={effectiveTheme} />
          </TutorialProvider>
        </FocusTimerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
