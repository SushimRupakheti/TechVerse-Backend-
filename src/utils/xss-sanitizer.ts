
const DANGEROUS_TAGS = ["script", "iframe", "object", "embed", "svg", "form"];

export function sanitizeUserText(value: string) {
  let sanitized = value.normalize("NFKC");

  // Remove complete dangerous elements and their content first. This turns
  for (const tag of DANGEROUS_TAGS) {
    sanitized = sanitized.replace(
      new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, "gi"),
      ""
    );
    sanitized = sanitized.replace(new RegExp(`<\\s*${tag}\\b[^>]*\\/?>`, "gi"), "");
  }

  // Remove inline event handlers such as onclick/onerror/onload/onmouseover.

  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "");

  // Remove dangerous URL protocols commonly used in XSS payloads.

  sanitized = sanitized.replace(/\b(?:javascript|data|vbscript)\s*:/gi, "");

  // Remove all remaining HTML tags because product descriptions do not support HTML.

  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Remove any remaining angle brackets and trim/collapse control characters.

  sanitized = sanitized
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

  return sanitized;
}

