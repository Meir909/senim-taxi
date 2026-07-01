export function normalizePhone(phone: string): string {
  let cleaned = phone.trim().replace(/[^\d+]/g, "");
  cleaned = cleaned.replace(/(?!^)\+/g, "");

  if (!cleaned) return "";

  if (cleaned.startsWith("+8")) {
    return `+7${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith("8")) {
    return `+7${cleaned.slice(1)}`;
  }

  if (!cleaned.startsWith("+") && /^\d+$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return cleaned;
}
