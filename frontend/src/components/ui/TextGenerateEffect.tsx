import { useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { cn } from "../../lib/utils";

export const TextGenerateEffect = ({
  words,
  className,
}: {
  words: string;
  className?: string;
}) => {
  const controls = useAnimation();
  const wordsArray = words.split(" ");

  useEffect(() => {
    controls.start((i) => ({
      opacity: 1,
      filter: "blur(0px)",
      transition: { delay: i * 0.04, duration: 0.2 },
    }));
  }, [words, controls]);

  return (
    <div className={cn("font-sans leading-relaxed text-slate-200", className)}>
      <motion.div className="flex flex-wrap gap-x-1 gap-y-0.5">
        {wordsArray.map((word, idx) => (
          <motion.span
            key={word + idx}
            custom={idx}
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={controls}
            className="inline-block"
          >
            {word}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
};
