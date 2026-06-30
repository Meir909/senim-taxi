import type { Database } from "@/integrations/supabase/types";
import { canBeDriverByIin, getAgeFromDob, parseIin } from "@/lib/iin";

export type PassengerProfile = Database["public"]["Tables"]["profiles"]["Row"];
export type PassengerChild = Database["public"]["Tables"]["passenger_children"]["Row"];

export function canManagePassengerChildren(profile: PassengerProfile | null): boolean {
  if (!profile) return false;

  if (profile.iin) {
    const parsed = parseIin(profile.iin);
    if (parsed) return canBeDriverByIin(parsed);
  }

  return (
    profile.gender === "female" &&
    !!profile.date_of_birth &&
    getAgeFromDob(profile.date_of_birth) >= 18
  );
}

export function getChildAge(birthDate: string): number {
  return getAgeFromDob(birthDate);
}

export function isChildUnder12(birthDate: string): boolean {
  const age = getChildAge(birthDate);
  return age >= 0 && age < 12;
}

export function formatChildMeta(child: Pick<PassengerChild, "birth_date">): string {
  return `${new Date(child.birth_date).toLocaleDateString("ru-RU")} · ${getChildAge(child.birth_date)} лет`;
}

export function formatMaskedIin(iin: string): string {
  if (iin.length !== 12) return iin;
  return `${iin.slice(0, 6)}••••${iin.slice(10)}`;
}
