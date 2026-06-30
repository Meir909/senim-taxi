export type Tariff = "standard" | "kids";

export const TARIFFS: Record<Tariff, {
  id: Tariff;
  name: string;
  description: string;
  base: number;
  perKm: number;
  perMin: number;
}> = {
  standard: {
    id: "standard",
    name: "Стандарт",
    description: "Обычная поездка",
    base: 500,
    perKm: 90,
    perMin: 18,
  },
  kids: {
    id: "kids",
    name: "Детский",
    description: "С детским креслом",
    base: 700,
    perKm: 130,
    perMin: 25,
  },
};

export function calcFare(tariff: Tariff, distanceM: number, durationS: number): number {
  const t = TARIFFS[tariff];
  const km = Math.max(0, distanceM) / 1000;
  const min = Math.max(0, durationS) / 60;
  const raw = t.base + km * t.perKm + min * t.perMin;
  return Math.max(0, Math.round(raw / 50) * 50);
}

export function fmtKzt(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₸";
}
