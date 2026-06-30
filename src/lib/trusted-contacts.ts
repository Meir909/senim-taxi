export type TrustedContact = {
  id: string;
  name: string;
  phone: string;
};

const STORAGE_KEY = "senim.trusted-contacts.v1";

type ContactPickerEntry = {
  name?: string[];
  tel?: string[];
};

type NavigatorWithContacts = Navigator & {
  contacts?: {
    select: (
      properties: Array<"name" | "tel">,
      options?: { multiple?: boolean },
    ) => Promise<ContactPickerEntry[]>;
  };
};

function sanitizeContact(input: Partial<TrustedContact>): TrustedContact | null {
  const name = String(input.name ?? "").trim();
  const phone = normalizePhone(String(input.phone ?? ""));
  if (!name || phone.length < 7) return null;
  return {
    id: String(input.id ?? safeId()),
    name,
    phone,
  };
}

function safeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("8") && !cleaned.startsWith("+")) {
    cleaned = `+7${cleaned.slice(1)}`;
  }
  if (!cleaned.startsWith("+") && /^\d+$/.test(cleaned)) {
    cleaned = `+${cleaned}`;
  }
  return cleaned;
}

export function loadTrustedContacts(): TrustedContact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<TrustedContact>>;
    return parsed
      .map(sanitizeContact)
      .filter((contact): contact is TrustedContact => contact !== null);
  } catch {
    return [];
  }
}

export function saveTrustedContacts(contacts: TrustedContact[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

export function supportsContactPicker(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator as NavigatorWithContacts).contacts?.select === "function";
}

export async function pickContactsFromDevice(): Promise<TrustedContact[]> {
  const contactsApi = (navigator as NavigatorWithContacts).contacts;
  if (!contactsApi?.select) return [];
  const picked = await contactsApi.select(["name", "tel"], { multiple: true });
  return picked
    .map((entry) =>
      sanitizeContact({
        name: entry.name?.[0] ?? "",
        phone: entry.tel?.[0] ?? "",
      }),
    )
    .filter((contact): contact is TrustedContact => contact !== null);
}

export function mergeTrustedContacts(
  current: TrustedContact[],
  incoming: TrustedContact[],
  max = 5,
): TrustedContact[] {
  const merged = [...current];
  for (const candidate of incoming) {
    const exists = merged.some(
      (contact) => normalizePhone(contact.phone) === normalizePhone(candidate.phone),
    );
    if (exists) continue;
    merged.push(candidate);
    if (merged.length >= max) break;
  }
  return merged.slice(0, max);
}

export function callPhoneNumber(phone: string) {
  if (typeof window === "undefined") return;
  window.location.href = `tel:${normalizePhone(phone)}`;
}
