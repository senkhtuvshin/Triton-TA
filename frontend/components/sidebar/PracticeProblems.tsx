"use client";
import { BookOpen, Flame } from "lucide-react";
import { type PracticeProblem } from "@/lib/types";
import GradientPillButton from "@/components/ui/gradient-pill-button";

interface PracticeProblemsProps {
  problems: PracticeProblem[];
  onProblemClick: (problem: string, source: string) => void;
}

export default function PracticeProblems({ problems, onProblemClick }: PracticeProblemsProps) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Suggested Practice</p>
      <div className="flex flex-col gap-2 items-start">
        {problems.map((p, i) => (
          <GradientPillButton
            key={i}
            icon={p.priority === "high" ? <Flame size={16} /> : <BookOpen size={16} />}
            label={`${p.source} #${p.problem}`}
            sublabel={p.reason ?? undefined}
            onClick={() => onProblemClick(p.problem, p.source)}
            expandedWidth="w-[212px]"
          />
        ))}
      </div>
    </div>
  );
}
