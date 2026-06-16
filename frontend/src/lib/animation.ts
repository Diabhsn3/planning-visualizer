// Shared framer-motion tokens for the visualizer UI. Extracted from
// Visualizer.tsx so sidebar sub-components can reuse the same motion language.

export const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const spring = { type: "spring", stiffness: 380, damping: 34 } as const;

export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};

export const modalVariants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1,    y: 0 },
  exit:    { opacity: 0, scale: 0.96, y: 4 },
};

export const listStagger = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

export const listItem = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0  },
};
