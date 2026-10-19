import type { ReactNode } from "react";
import { humanize } from "@/lib/format";

type Tone = "neutral" | "green" | "amber" | "red" | "honey";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-ink/5 text-ink/70 border-ink/10",
  green: "bg-forest/10 text-forest border-forest/20",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  red: "bg-red-100 text-red-800 border-red-200",
  honey: "bg-honey/15 text-honey-dark border-honey/30",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

/** Consistent status colouring across orders / payments / products / accounts. */
export function StatusBadge({ status }: { status: string }) {
  const tone: Tone = (() => {
    switch (status) {
      case "published":
      case "delivered":
      case "succeeded":
      case "active":
      case "received":
      case "completed":
        return "green";
      case "confirmed":
      case "processing":
      case "shipped":
      case "partially_received":
      case "ordered":
      case "initiated":
      case "pending":
        return "amber";
      case "cancelled":
      case "refunded":
      case "failed":
      case "suspended":
      case "archived":
        return "red";
      case "draft":
      case "created":
      case "pending_payment":
        return "neutral";
      default:
        return "honey";
    }
  })();
  return <Badge tone={tone}>{humanize(status)}</Badge>;
}
