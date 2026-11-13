"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { postToHost } from "@/lib/embed";

interface EmbedFrameProps {
  children: ReactNode;
}

/**
 * R410: wraps an embed page and keeps the host's iframe exactly as tall as the
 * content, so the widget never shows a scrollbar of its own. It measures this
 * wrapper rather than the document, which is at least as tall as the iframe
 * and so could never report shrinking.
 */
export function EmbedFrame({ children }: EmbedFrameProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let last = 0;
    const report = () => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height !== last) {
        last = height;
        postToHost({ type: "booking-widget:resize", height });
      }
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
