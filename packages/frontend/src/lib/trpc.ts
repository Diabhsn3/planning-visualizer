import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@planning-visualizer/types";

export const trpc = createTRPCReact<AppRouter>();
