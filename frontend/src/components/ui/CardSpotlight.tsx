import React, { useRef, useState } from "react";
import { cn } from "../../lib/utils";

export interface CardSpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  radius?: number;
  color?: string;
  className?: string;
}

export const CardSpotlight: React.FC<CardSpotlightProps> = ({
  children,
  radius = 250,
  color = "rgba(59, 130, 246, 0.15)",
  className,
  ...props
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseEnter = () => {
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group relative rounded-2xl border border-slate-800/80 bg-slate-950/70 p-5 backdrop-blur-xl transition-all duration-300 hover:border-slate-700/80 hover:shadow-2xl hover:shadow-blue-950/20",
        className
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${radius}px circle at ${position.x}px ${position.y}px, ${color}, transparent 80%)`,
          opacity,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};
