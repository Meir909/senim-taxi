export type Tariff = "standard" | "kids" | "delivery" | "cargo";

<<<<<<< HEAD
export const TARIFFS: Record<
  Tariff,
  {
    id: Tariff;
    name: string;
    description: string;
    base: number;
    perKm: number;
    perMin: number;
  }
> = {
=======
export const TARIFFS: Record<Tariff, {
  id: Tariff;
  name: string;
  description: string;
  base: number;
  perKm: number;
  perMin: number;
}> = {
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
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
<<<<<<< HEAD
    name: "Для ребенка",
    description: "Поездка для ребёнка до 12 лет с подтверждением получателя",
    base: 800,
    perKm: 140,
    perMin: 26,
=======
    name: "Детский",
    description: "С детским креслом",
    base: 700,
    perKm: 130,
    perMin: 25,
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  },
  delivery: {
    id: "delivery",
    name: "Доставка",
    description: "Курьер — небольшие посылки",
    base: 400,
    perKm: 80,
    perMin: 12,
  },
  cargo: {
    id: "cargo",
    name: "Грузовая",
    description: "Доставка крупных грузов",
    base: 1200,
    perKm: 180,
    perMin: 30,
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
