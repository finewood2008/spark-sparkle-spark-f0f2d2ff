import { createRouter, useRouter, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  const navigate = useNavigate();

  // Detect a thrown Response (typically from server-fn auth middleware)
  const isResponse = typeof Response !== "undefined" && error instanceof Response;
  const status = isResponse ? (error as Response).status : undefined;
  const isAuthError = isResponse && (status === 401 || status === 403);

  useEffect(() => {
    if (isAuthError) {
      const t = setTimeout(() => {
        navigate({ to: "/auth" });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [isAuthError, navigate]);

  const errorMessage =
    error instanceof Error
      ? error.message
      : isResponse
        ? `${status} ${(error as Response).statusText || ""}`.trim()
        : String(error);

  if (isAuthError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">会话已过期</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            登录状态已失效，正在跳转到登录页…
          </p>
          <div className="mt-6">
            <button
              onClick={() => navigate({ to: "/auth" })}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              立即重新登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        {import.meta.env.DEV && errorMessage && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {errorMessage}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
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

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
