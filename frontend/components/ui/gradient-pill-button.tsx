"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

// UCSD gold gradient: #C69214 → #E8B84B

interface GradientPillButtonProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export default function GradientPillButton({
  icon,
  label,
  sublabel,
  onClick,
  active = false,
  className,
}: GradientPillButtonProps) {
  const [hovered, setHovered] = useState(false);
  const expanded = active || hovered;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: expanded ? "212px" : "40px",
        transition: "width 500ms cubic-bezier(0.4,0,0.2,1), box-shadow 500ms",
        boxShadow: expanded ? "none" : undefined,
      }}
      className={cn(
        "relative h-10 rounded-full flex items-center justify-center",
        "cursor-pointer overflow-hidden group",
        !expanded && "shadow-md bg-white/10",
        className
      )}
    >
      {/* Gold gradient fill */}
      <span
        className="absolute inset-0 rounded-full transition-opacity duration-500"
        style={{
          background: "linear-gradient(45deg, #C69214, #E8B84B)",
          opacity: expanded ? 1 : 0,
        }}
      />

      {/* Glow behind */}
      <span
        className="absolute top-[8px] inset-x-0 h-full rounded-full -z-10 blur-[12px] transition-opacity duration-500"
        style={{
          background: "linear-gradient(45deg, #C69214, #E8B84B)",
          opacity: expanded ? 0.4 : 0,
        }}
      />

      {/* Icon — shrinks out when expanded */}
      <span
        className="relative z-10 shrink-0 flex items-center justify-center text-white/60 transition-all duration-300"
        style={{
          transform: expanded ? "scale(0)" : "scale(1)",
          width: expanded ? 0 : undefined,
          transitionDelay: expanded ? "0ms" : "100ms",
        }}
      >
        {icon}
      </span>

      {/* Label — scales in when expanded */}
      <span
        className="absolute z-10 flex flex-col items-center justify-center px-3 transition-all duration-300"
        style={{
          transform: expanded ? "scale(1)" : "scale(0)",
          opacity: expanded ? 1 : 0,
          transitionDelay: expanded ? "120ms" : "0ms",
        }}
      >
        <span className="text-[#0F1D30] font-bold text-xs leading-tight whitespace-nowrap uppercase tracking-wider">
          {label}
        </span>
        {sublabel && (
          <span className="text-[#0F1D30]/55 text-[9px] whitespace-nowrap leading-tight mt-0.5 normal-case tracking-normal font-normal">
            {sublabel}
          </span>
        )}
      </span>
    </button>
  );
}
