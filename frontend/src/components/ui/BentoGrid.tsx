import React from "react";
import { cn } from "../../lib/utils";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
  onClick,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "row-span-1 rounded-2xl group/bento hover:shadow-xl transition duration-300 shadow-none p-5 bg-slate-950/60 border border-white/[0.08] hover:border-blue-500/30 justify-between flex flex-col space-y-4 backdrop-blur-md cursor-pointer",
        className
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-1 transition duration-200">
        {icon}
        <div className="font-sans font-bold text-slate-100 mb-1 mt-2 text-base">
          {title}
        </div>
        <div className="font-sans font-normal text-slate-400 text-xs">
          {description}
        </div>
      </div>
    </div>
  );
};
