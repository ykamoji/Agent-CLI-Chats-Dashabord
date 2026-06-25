"use client";

export default function AgentBadge({ agent }: { agent: string }) {
  const a = agent.toLowerCase();
  const isClaude = a.includes("claude");
  const label = isClaude ? "Claude" : a.includes("anti") ? "Antigravity" : agent || "—";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isClaude ? "bg-ink text-paper" : "border border-ink/20 bg-white text-ink"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isClaude ? "bg-paper" : "bg-ink"}`} />
      {label}
    </span>
  );
}
