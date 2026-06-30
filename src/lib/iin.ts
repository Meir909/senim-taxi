// Kazakhstan IIN (12 digits) validation, gender + DOB extraction.
// Spec: positions 7 = century+gender (1..6), positions 1-6 = YYMMDD.

const W1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const W2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

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

export function parseIin(iin: string): { dob: string; gender: "male" | "female" } | null {
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
  const m = Number(mm), day = Number(dd);
  if (m < 1 || m > 12 || day < 1 || day > 31) return null;
  const dob = `${yearNum}-${mm}-${dd}`;
  // sanity date check
  const t = new Date(dob);
  if (Number.isNaN(t.getTime())) return null;
  const gender = g % 2 === 1 ? "male" : "female";
  return { dob, gender };
}
