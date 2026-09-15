import { motion } from "framer-motion";

export const BackgroundBeams = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#030712]">
      {/* Radial Gradient Ambient Lighting */}
      <div className="absolute -left-[20%] -top-[10%] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[140px]" />
      <div className="absolute -right-[20%] top-[40%] h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-[160px]" />
      <div className="absolute bottom-[0%] left-[30%] h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[150px]" />

      {/* Cyber Grid SVG Overlay */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.15]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="cyber-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cyber-grid)" />
      </svg>

      {/* Animated Floating Light Beams */}
      <motion.div
        animate={{
          y: [-20, 20, -20],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute left-1/4 top-0 h-[400px] w-[1px] bg-gradient-to-b from-transparent via-cyan-500/40 to-transparent"
      />
      <motion.div
        animate={{
          y: [30, -30, 30],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute right-1/3 top-10 h-[500px] w-[1px] bg-gradient-to-b from-transparent via-blue-500/30 to-transparent"
      />
    </div>
  );
};
