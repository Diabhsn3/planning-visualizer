# @planning-visualizer/types

Shared TypeScript types for the Planning Visualizer project.

## Purpose

This package provides type-safe API contracts between the frontend and backend by re-exporting the tRPC `AppRouter` type from the backend.

## Usage

Both frontend and backend packages depend on this package to maintain type safety across the API boundary.

### In Frontend

```typescript
import type { AppRouter } from '@planning-visualizer/types';
```

### In Backend

The backend exports the `AppRouter` type which is then re-exported by this package.

## Development

```bash
# Build types
pnpm build

# Watch for changes
pnpm watch
```

## Note

This package is part of a pnpm workspace monorepo and uses `workspace:*` protocol for internal dependencies.
