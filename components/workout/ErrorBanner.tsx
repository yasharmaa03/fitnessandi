"use client";
import Button from "@/components/ui/Button";

/**
 * Shared ErrorBanner component for workout feature pages.
 *
 * Renders an accessible alert banner with a descriptive message and a retry
 * button. Matches the inline ErrorBanner pattern used throughout the nutrition
 * section and is intentionally styled to stand out against both light and dark
 * backgrounds.
 *
 * Requirements: 15.1 (error banner with retry), 8.6 (inline ErrorBanner)
 */
export default function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-[#DC2626]"
    >
      <span className="font-body text-[13px]">⚠ {message}</span>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        Retry →
      </Button>
    </div>
  );
}
