import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Clock, Loader2, MapPin, Route as RouteIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TARIFFS, fmtKzt } from "@/lib/fare";
import { fmtElapsed, type Ride } from "@/lib/passenger-rides";

const SEARCH_MESSAGES = [
  "Ищем ближайшего водителя…",
  "Отправляем запрос подходящим водителям по городу",
  "Подбираем оптимальный вариант для вас",
  "Чуть-чуть терпения — почти нашли",
  "Проверяем водителей в зоне вашего заказа",
];

function estimatedPickupMin(elapsedSec: number): number {
  const base = 4 + Math.floor(elapsedSec / 30);
  return Math.min(12, base);
}

export function PassengerSearchingPage({
  ride,
  onCancel,
  cancelling,
}: {
  ride: Ride;
  onCancel: () => void | Promise<void>;
  cancelling?: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const startedAt = useMemo(() => new Date(ride.requested_at).getTime(), [ride.requested_at]);

  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [startedAt]);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setMsgIdx((value) => (value + 1) % SEARCH_MESSAGES.length),
      3500,
    );
    return () => window.clearInterval(intervalId);
  }, []);

  const tariff = TARIFFS[(ride.tariff as keyof typeof TARIFFS) ?? "standard"] ?? TARIFFS.standard;
  const etaMin = estimatedPickupMin(elapsed);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/70 p-6 text-primary-foreground shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="relative grid h-20 w-20 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary-foreground/30" />
            <span className="absolute inset-2 animate-pulse rounded-full bg-primary-foreground/20" />
            <Loader2 className="relative h-10 w-10 animate-spin" />
          </div>
          <div className="mt-4 text-2xl font-bold tabular-nums">{fmtElapsed(elapsed)}</div>
          <div className="mt-1 min-h-[2.5rem] text-sm opacity-95 transition-opacity">
            {SEARCH_MESSAGES[msgIdx]}
          </div>

          <div className="mt-4 grid w-full grid-cols-2 gap-2">
            <div className="rounded-lg bg-primary-foreground/15 px-3 py-2 text-left">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Зона поиска</div>
              <div className="mt-0.5 text-base font-semibold">Весь город</div>
              <div className="mt-1 text-[11px] opacity-80">Поиск идёт по зоне вашего заказа</div>
            </div>
            <div className="rounded-lg bg-primary-foreground/15 px-3 py-2 text-left">
              <div className="text-[10px] uppercase tracking-wide opacity-80">ETA подачи</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">~{etaMin} мин</div>
              <div className="mt-1 text-[11px] opacity-80">обновляется автоматически</div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Детали заказа
          </div>
          <Badge variant="outline">#{ride.id.slice(0, 8)}</Badge>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Откуда</div>
              <div className="truncate font-medium">
                {ride.pickup_address ||
                  `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Куда</div>
              <div className="truncate font-medium">
                {ride.dropoff_address ||
                  `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <SearchStat
              icon={<RouteIcon className="h-3.5 w-3.5" />}
              label="Тариф"
              value={tariff.name}
            />
            <SearchStat
              icon={<Clock className="h-3.5 w-3.5" />}
              label="В пути"
              value={ride.duration_min != null ? `${ride.duration_min} мин` : "—"}
            />
            <SearchStat
              label="Цена"
              value={ride.estimated_fare != null ? fmtKzt(Number(ride.estimated_fare)) : "—"}
            />
          </div>
        </div>
      </Card>

      {confirmCancel ? (
        <Card className="space-y-3 p-4">
          <p className="text-sm">Отменить заказ? Поиск водителя будет остановлен.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={cancelling} onClick={() => setConfirmCancel(false)}>
              Нет
            </Button>
            <Button variant="destructive" disabled={cancelling} onClick={() => void onCancel()}>
              {cancelling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <X className="mr-2 h-4 w-4" />
              )}
              Отменить
            </Button>
          </div>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          size="lg"
          disabled={cancelling}
          onClick={() => setConfirmCancel(true)}
        >
          <X className="mr-2 h-4 w-4" /> Отменить заказ
        </Button>
      )}
    </div>
  );
}

function SearchStat({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
