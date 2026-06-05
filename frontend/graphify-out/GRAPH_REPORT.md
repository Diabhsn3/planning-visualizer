# Graph Report - frontend  (2026-06-06)

## Corpus Check
- 45 files · ~673,469 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 175 nodes · 166 edges · 8 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `renderSatellite()` - 12 edges
2. `renderRovers()` - 6 edges
3. `norm()` - 5 edges
4. `getLoginUrl()` - 4 edges
5. `isOneOf()` - 4 edges
6. `getRelTargetSingle()` - 4 edges
7. `ErrorBoundary` - 4 edges
8. `useComposition()` - 4 edges
9. `drawRoundedRect()` - 3 edges
10. `drawLabel()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `redirectToLoginIfUnauthorized()` --calls--> `getLoginUrl()`  [INFERRED]
  src/main.tsx → src/const.ts
- `useAuth()` --calls--> `getLoginUrl()`  [INFERRED]
  src/_core/hooks/useAuth.ts → src/const.ts
- `Toaster()` --calls--> `useTheme()`  [INFERRED]
  src/components/ui/sonner.tsx → src/contexts/ThemeContext.tsx
- `Textarea()` --calls--> `useDialogComposition()`  [INFERRED]
  src/components/ui/textarea.tsx → src/components/ui/dialog.tsx
- `Input()` --calls--> `useDialogComposition()`  [INFERRED]
  src/components/ui/input.tsx → src/components/ui/dialog.tsx

## Communities (37 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (4): getDefaultProblem(), handleGenerate(), handleReuseExistingVersion(), setTransformerModelInfo()

### Community 1 - "Community 1"
Cohesion: 0.27
Nodes (12): actionTag(), drawBadge(), drawLabel(), drawRoundedRect(), drawTargetMarker(), drawThinLine(), getRelTargetSingle(), isOneOf() (+4 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (5): useComposition(), usePersistFn(), useDialogComposition(), Input(), Textarea()

### Community 3 - "Community 3"
Cohesion: 0.24
Nodes (6): drawTargetMarker(), getEdgePoint(), isAnimationActive(), parseAction(), renderRovers(), startAnimationForStep()

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (3): useAuth(), getLoginUrl(), redirectToLoginIfUnauthorized()

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (3): ThemeProvider(), useTheme(), Toaster()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `getLoginUrl()` (e.g. with `redirectToLoginIfUnauthorized()` and `useAuth()`) actually correct?**
  _`getLoginUrl()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._