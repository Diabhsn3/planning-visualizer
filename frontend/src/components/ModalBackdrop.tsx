import { motion } from "framer-motion";
import { modalVariants } from "@/lib/animation";

/** Full-screen dimmed backdrop with a spring-animated, centered modal card.
 *  Clicking the backdrop calls onClose; clicks inside the card are ignored. */
export const ModalBackdrop = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    onClick={onClose}
    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
  >
    <motion.div {...modalVariants} transition={{ type: "spring", stiffness: 350, damping: 28 }}
      onClick={e => e.stopPropagation()}>
      {children}
    </motion.div>
  </motion.div>
);
