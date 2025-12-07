# Planning Visualizer - Frontend

React frontend application for the Planning Visualizer.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## 📁 Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── contexts/       # React contexts
│   ├── lib/            # Utilities and tRPC client
│   ├── App.tsx         # Main app component with routes
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── public/             # Static assets
└── index.html          # HTML template
```

## 🔌 API Connection

The frontend connects to the backend API at `http://localhost:5000/api`.

Vite proxy configuration in `vite.config.ts` handles the routing:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  },
}
```

## 🛠 Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **tRPC** - Type-safe API client
- **Vite** - Build tool and dev server
- **Wouter** - Lightweight routing

## 📝 Development

### Adding a New Page

1. Create component in `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`:
```typescript
<Route path="/new-page" component={NewPage} />
```

### Calling Backend API

Use tRPC hooks:
```typescript
import { trpc } from '@/lib/trpc';

function MyComponent() {
  const { data, isLoading } = trpc.visualizer.generateStates.useQuery({
    domain: 'blocks-world'
  });
  
  return <div>{data?.states.length} states generated</div>;
}
```

### Styling

Use Tailwind CSS classes:
```typescript
<div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow">
  <h1 className="text-2xl font-bold">Hello</h1>
</div>
```

## 🧪 Testing

```bash
pnpm test
```

## 📦 Building

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

Output will be in `dist/` directory.

## 🔍 Troubleshooting

### Can't connect to backend
- Ensure backend is running: `cd ../backend/api && pnpm dev`
- Check backend is on port 5000
- Check Vite proxy configuration

### TypeScript errors
- Run type check: `pnpm check`
- Restart VS Code TypeScript server

### Styling issues
- Clear Tailwind cache: `rm -rf node_modules/.cache`
- Restart dev server

---

For more information, see the main [README_NEW_STRUCTURE.md](../README_NEW_STRUCTURE.md).
