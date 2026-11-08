"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function ProjectRefresh({ count }: { count: number }) {
  const router = useRouter();
  const previousCount = useRef(count);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [router]);
  useEffect(() => {
    const previous = previousCount.current;
    previousCount.current = count;
    if (count <= previous) return;
    const chatBottom = document.getElementById("project-chat-bottom");
    if (chatBottom && chatBottom.getBoundingClientRect().top - window.innerHeight < 300) {
      chatBottom.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [count]);
  return null;
}
