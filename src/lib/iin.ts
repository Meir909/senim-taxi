const W1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const W2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

export type IinGender = "male" | "female";
export type ParsedIin = { dob: string; gender: IinGender };

function checksum(d: number[]): number | null {
  let s = d.slice(0, 11).reduce((acc, n, i) => acc + n * W1[i], 0);
  let c = s % 11;
  if (c === 10) {
    s = d.slice(0, 11).reduce((acc, n, i) => acc + n * W2[i], 0);
    c = s % 11;
    if (c === 10) return null;
  }
  return c;
}

export function parseIin(iin: string): ParsedIin | null {
  if (!/^\d{12}$/.test(iin)) return null;
  const d = iin.split("").map(Number);
  const c = checksum(d);
  if (c === null || c !== d[11]) return null;

  const yy = iin.slice(0, 2);
  const mm = iin.slice(2, 4);
  const dd = iin.slice(4, 6);
  const g = d[6];
  if (g < 1 || g > 6) return null;
  const century = g <= 2 ? 1800 : g <= 4 ? 1900 : 2000;
  const yearNum = century + Number(yy);
  const m = Number(mm),
    day = Number(dd);
  if (m < 1 || m > 12 || day < 1 || day > 31) return null;
  const dob = `${yearNum}-${mm}-${dd}`;
  const t = new Date(dob);
  if (Number.isNaN(t.getTime())) return null;
  const gender = g % 2 === 1 ? "male" : "female";
  return { dob, gender };
}

export function getAgeFromDob(dob: string, now = new Date()): number {
  const birthDate = new Date(dob);
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  const dayDiff = now.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

export function isAdultByDob(dob: string, now = new Date()): boolean {
  return getAgeFromDob(dob, now) >= 18;
}

export function canBeDriverByIin(parsed: ParsedIin, now = new Date()): boolean {
  return parsed.gender === "female" && isAdultByDob(parsed.dob, now);
}

export function canBePassengerByIin(parsed: ParsedIin, now = new Date()): boolean {
  return getAgeFromDob(parsed.dob, now) < 18;
}
