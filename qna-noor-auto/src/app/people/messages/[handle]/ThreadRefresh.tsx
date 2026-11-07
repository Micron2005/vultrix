"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ThreadRefresh({ messageCount }: { messageCount: number }) {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [router]);

  useEffect(() => {
    document
      .getElementById("message-thread-bottom")
      ?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messageCount]);

  return null;
}
