export const CHAT_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;

export const CHAT_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

export function safeAttachmentName(value: string) {
  const printable = [...value.normalize("NFKC")]
    .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
    .join("");
  const base = printable
    .replace(/[\\/<>:"|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return base || "attachment";
}

export function attachmentValidationMessage(file: {
  name: string;
  type: string;
  size: number;
}) {
  if (!file.size) return "Choose a file that is not empty.";
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES)
    return "Attachments must be 4 MB or smaller.";
  if (!CHAT_ATTACHMENT_TYPES.has(file.type))
    return "Send a PDF, text file, JPG, PNG, or WebP image.";
  return "";
}

export function hasExpectedFileSignature(type: string, bytes: Uint8Array) {
  if (type === "text/plain") return !bytes.includes(0);
  if (type === "application/pdf")
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (type === "image/jpeg")
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return (
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    );
  if (type === "image/webp")
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}
