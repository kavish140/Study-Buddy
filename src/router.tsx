import { QueryClient, QueryCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { userErrorMessage } from "./lib/user-error";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (typeof window !== "undefined")
          toast.error(
            userErrorMessage(error, "Your study data could not load. Please try again."),
            { id: "study-data-error" },
          );
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const status = (error as { status?: number }).status;
          return (
            failureCount < 1 && status !== 401 && status !== 403 && status !== 422 && status !== 429
          );
        },
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
