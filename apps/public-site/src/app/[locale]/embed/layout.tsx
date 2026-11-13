import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EmbedFrame } from "@/components/EmbedFrame";

// R410: pages made to be framed by a salon's own website. Never indexed: the
// same content lives on the salon's booking site proper.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return <EmbedFrame>{children}</EmbedFrame>;
}
