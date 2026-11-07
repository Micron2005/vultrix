"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ProjectRefresh({ count }: { count: number }) {
  const router = useRouter();
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [router]);
  useEffect(() => {
    document.getElementById("project-chat-bottom")?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [count]);
  return null;
}
