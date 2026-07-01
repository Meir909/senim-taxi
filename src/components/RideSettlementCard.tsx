import { Wallet, ArrowDownLeft, ArrowUpRight, Percent } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fmtKzt } from "@/lib/fare";
import type { Database } from "@/integrations/supabase/types";

type RideFinancePreview = Pick<
  Database["public"]["Tables"]["rides"]["Row"],
  "estimated_fare" | "fare_amount"
>;

function getRideAmount(ride: RideFinancePreview) {
  const raw = ride.estimated_fare ?? ride.fare_amount;
  return raw == null ? null : Number(raw);
}

function getCommission(amount: number) {
  return Number((amount * 0.17).toFixed(2));
}

function getDriverEarnings(amount: number) {
  return Number((amount - getCommission(amount)).toFixed(2));
}

export function RideSettlementCard({
  ride,
  audience,
}: {
  ride: RideFinancePreview;
  audience: "passenger" | "driver";
}) {
  const amount = getRideAmount(ride);
  const commission = amount != null ? getCommission(amount) : null;
  const earnings = amount != null ? getDriverEarnings(amount) : null;

  return (
    <Card className="border-primary/15 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Wallet className="h-4 w-4 text-primary" />
        <span>Расчёт после завершения поездки</span>
      </div>

      {amount == null ? (
        <div className="mt-2 text-sm text-muted-foreground">
          Итоговая сумма пока уточняется. После завершения поездки пассажир оплатит полную
          стоимость, а водителю в кошелёк поступит сумма уже за вычетом 17% комиссии.
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-background/80 px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              <ArrowDownLeft className="h-3.5 w-3.5" />
              {audience === "passenger" ? "Спишется" : "Оплатит пассажир"}
            </div>
            <div className="mt-1 text-sm font-semibold">{fmtKzt(amount)}</div>
          </div>
          <div className="rounded-lg border bg-background/80 px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Percent className="h-3.5 w-3.5" />
              Комиссия 17%
            </div>
            <div className="mt-1 text-sm font-semibold">{fmtKzt(commission ?? 0)}</div>
          </div>
          <div className="rounded-lg border bg-background/80 px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {audience === "passenger" ? "Получит водитель" : "Поступит в кошелёк"}
            </div>
            <div className="mt-1 text-sm font-semibold">{fmtKzt(earnings ?? 0)}</div>
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-muted-foreground">
        {audience === "passenger"
          ? "Если в кошельке не хватит денег, баланс уйдёт в минус и появится задолженность."
          : "Водителю зачисляется сумма уже после удержания комиссии платформы."}
      </div>
    </Card>
  );
}
