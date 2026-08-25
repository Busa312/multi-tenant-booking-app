import { jsonLdScriptContent } from "@/lib/json-ld";

interface JsonLdProps {
  data: Record<string, unknown>;
}

/**
 * Structured data as a `<script type="application/ld+json">` block.
 *
 * `dangerouslySetInnerHTML` is required — React would otherwise HTML-escape the
 * JSON and break it — so the escaping is jsonLdScriptContent's job, and that is
 * the only place it should ever be done.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(data) }} />
  );
}
