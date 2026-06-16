import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from './const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const fetchWithCredentials = (input: RequestInfo | URL, init?: RequestInit) =>
  globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });

// Sent only when VITE_ADMIN_TOKEN is configured at build time. The server gates
// data-export endpoints behind this header when ADMIN_TOKEN is set; otherwise
// the header is absent and those endpoints stay open (local/dev).
const adminToken = import.meta.env.VITE_ADMIN_TOKEN as string | undefined;
const adminHeaders = (): Record<string, string> =>
  adminToken ? { "x-admin-token": adminToken } : {};

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      // Mutations always go via individual httpLink (POST), never batched as GET
      condition: (op) => op.type === "mutation",
      true: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: fetchWithCredentials,
        headers: adminHeaders,
      }),
      false: httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: fetchWithCredentials,
        headers: adminHeaders,
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
