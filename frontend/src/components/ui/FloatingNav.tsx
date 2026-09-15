import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Home,
  User as UserIcon,
  LogIn,
  LogOut,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { Page, User } from "../../types";

interface FloatingNavProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  connected: boolean;
  monitoring: boolean;
  onStartMonitoring: () => void;
  onStopMonitoring: () => void;
  onStartDemo: () => void;
  demoMode: boolean;
  user: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const FloatingNav: React.FC<FloatingNavProps> = ({
  activePage,
  setActivePage,
  connected,
  monitoring,
  onStartMonitoring,
  onStopMonitoring,
  onStartDemo,
  demoMode,
  user,
  onOpenAuth,
  onLogout,
}) => {
  const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home className="h-4 w-4" /> },
    { id: "monitor", label: "Live Monitor", icon: <Activity className="h-4 w-4" /> },
    { id: "incidents", label: "Incidents Hub", icon: <AlertTriangle className="h-4 w-4" /> },
    { id: "diagnostics", label: "System Diagnostics", icon: <Cpu className="h-4 w-4" /> },
  ];

  return (
    <header className="sticky top-0 z-50 w-full px-4 pt-3 pb-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 shadow-2xl shadow-black/40">
        {/* Brand Logo */}
        <button
          onClick={() => setActivePage("home")}
          className="flex items-center gap-3 text-left focus:outline-none"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-base">
                CrashVision
              </span>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                AI v2.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Computer Vision Safeguard</p>
          </div>
        </button>

        {/* Floating Nav Tabs */}
        <nav className="hidden md:flex items-center gap-1 rounded-xl bg-slate-900/80 p-1 border border-white/5">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition duration-200",
                  isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-600/30"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{item.icon}</span>
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls & User Auth Badge */}
        <div className="flex items-center gap-2.5">
          {/* Status Badge */}
          <div className="hidden lg:flex items-center gap-2 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
            <span
              className={cn(
                "h-2 w-2 rounded-full animate-pulse",
                connected ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-slate-600"
              )}
            />
            <span className="text-[11px] font-medium">
              {demoMode
                ? "Demo Stream Active"
                : connected
                ? "Backend Connected"
                : "Standby"}
            </span>
          </div>

          {/* Demo Stream Quick Action Button */}
          <button
            onClick={onStartDemo}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-semibold transition border hidden sm:block",
              demoMode
                ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-300"
                : "border-white/10 bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            ⚡ Demo Feed
          </button>

          {/* Start/Stop Real Stream */}
          {!monitoring ? (
            <button
              onClick={onStartMonitoring}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 active:scale-95"
            >
              Start Monitor
            </button>
          ) : (
            <button
              onClick={onStopMonitoring}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 active:scale-95"
            >
              Stop Monitor
            </button>
          )}

          {/* User Auth Profile Dropdown / Sign In Button */}
          {user ? (
            <div className="flex items-center gap-2 pl-1 border-l border-white/10">
              <div className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold text-blue-300">
                <UserIcon className="h-3.5 w-3.5 text-blue-400" />
                <span className="hidden sm:inline">{user.full_name || user.username}</span>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="rounded-xl p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-300 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition active:scale-95"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="mt-2 flex md:hidden items-center justify-around rounded-xl border border-white/10 bg-slate-950/90 p-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-medium transition",
              activePage === item.id
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </header>
  );
};
