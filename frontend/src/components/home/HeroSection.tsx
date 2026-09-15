import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Zap,
  Lock,
  Cpu,
  ArrowRight,
  Cloud,
  MessageSquareText,
  Sparkles,
  Play,
  CheckCircle2,
} from "lucide-react";
import type { Page } from "../../types";

interface HeroSectionProps {
  onNavigate: (page: Page) => void;
  onStartDemo: () => void;
  onOpenAuth: () => void;
  isLoggedIn: boolean;
  userName?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onNavigate,
  onStartDemo,
  onOpenAuth,
  isLoggedIn,
  userName,
}) => {
  const stats = [
    { label: "Vision Accuracy", value: "99.2%", detail: "YOLOv8 Dual Engine" },
    { label: "Detection Latency", value: "<45ms", detail: "Real-time GPU Stream" },
    { label: "Cloud Evidence", value: "AWS S3", detail: "Automated Vault Sync" },
    { label: "AI Analysis", value: "Groq LLM", detail: "LangChain Assistant" },
  ];

  const features = [
    {
      icon: <Activity className="h-6 w-6 text-blue-400" />,
      title: "Real-Time YOLOv8 Vision",
      description:
        "Dual model architecture running custom accident classification alongside vehicle/object bounding box tracking.",
      badge: "Real-Time Pipeline",
    },
    {
      icon: <Cloud className="h-6 w-6 text-cyan-400" />,
      title: "AWS S3 Evidence Vault",
      description:
        "Automatic pre-roll and post-roll video segment encoding into browser-compatible H.264 MP4 stored with presigned URLs.",
      badge: "Secure S3 Archiving",
    },
    {
      icon: <MessageSquareText className="h-6 w-6 text-indigo-400" />,
      title: "LangChain Incident Chat",
      description:
        "Conversational AI bot powered by Groq LLM allowing security teams to query severity, vehicle types, and timeline.",
      badge: "LLM Intelligence",
    },
    {
      icon: <Cpu className="h-6 w-6 text-emerald-400" />,
      title: "Modular FastAPI Core",
      description:
        "Asynchronous Python backend with MongoDB persistence, WebSocket streaming, and structured auth APIs.",
      badge: "Production Ready",
    },
  ];

  const techStack = [
    "PyTorch",
    "YOLOv8",
    "FastAPI",
    "LangChain",
    "Groq LLM",
    "AWS S3",
    "MongoDB",
    "OpenCV",
    "React 19",
    "TypeScript",
    "Tailwind CSS",
  ];

  return (
    <div className="relative py-8 md:py-16 space-y-16">
      {/* Hero Header Section */}
      <div className="text-center max-w-4xl mx-auto space-y-6">
        {/* Animated Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300 shadow-lg shadow-blue-500/10 backdrop-blur-md"
        >
          <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span>AI-POWERED HIGHWAY SAFEGUARD v2.0</span>
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] text-cyan-200">
            NEXT-GEN
          </span>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight"
        >
          Automated Traffic Incident Detection &{" "}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            Neural Intelligence
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed"
        >
          CrashVision AI combines high-speed YOLO computer vision detection,
          automated AWS S3 video evidence archiving, and LangChain LLM
          incident reports to safeguard roadways in real time.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-4 pt-4"
        >
          <button
            onClick={() => onNavigate("monitor")}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/30 transition hover:brightness-110 active:scale-95"
          >
            <Activity className="h-4 w-4" />
            <span>Launch Live Monitor</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => {
              onNavigate("monitor");
              onStartDemo();
            }}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white active:scale-95"
          >
            <Play className="h-4 w-4 text-cyan-400 fill-cyan-400" />
            <span>Explore Demo Feed</span>
          </button>

          {!isLoggedIn ? (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 active:scale-95"
            >
              <Lock className="h-4 w-4" />
              <span>Operator Sign In</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Logged in as {userName}</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Hero Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto"
      >
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-center shadow-xl backdrop-blur-md hover:border-blue-500/30 transition duration-300"
          >
            <div className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              {stat.value}
            </div>
            <div className="text-xs font-bold text-white mt-1">{stat.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{stat.detail}</div>
          </div>
        ))}
      </motion.div>

      {/* Core Architectural Features Section */}
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Autonomous Surveillance Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            From raw camera frames to AI incident reports, explore how CrashVision protects roadways.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.1 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-xl hover:border-blue-500/40 transition duration-300 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 border border-white/10 group-hover:scale-110 transition duration-300">
                  {feat.icon}
                </div>
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                  {feat.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feat.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {feat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Tech Stack Pills */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 max-w-5xl mx-auto text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          <Zap className="h-4 w-4 text-blue-400" />
          <span>POWERED BY MODERN DEEP LEARNING & FULL STACK TECHNOLOGIES</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {techStack.map((tech, idx) => (
            <span
              key={idx}
              className="rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-1.5 text-xs font-mono font-medium text-slate-300 hover:border-blue-500/40 hover:text-white transition"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
