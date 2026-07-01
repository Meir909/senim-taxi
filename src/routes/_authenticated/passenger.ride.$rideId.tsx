import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  ArrowLeft,
  MapPin,
  Clock,
  Route as RouteIcon,
  Car,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapGL, type MapMarker } from "@/components/MapGL";
import { StarRating } from "@/components/StarRating";
import { TripSafetyCard } from "@/components/TripSafetyPanel";
import { UserBadgeCard } from "@/components/UserBadgeCard";
import { TARIFFS, fmtKzt } from "@/lib/fare";
import { supabase } from "@/integrations/supabase/client";
import { useRideDropoffPin } from "@/hooks/useRideDropoffPin";
import { useRidePickupPin } from "@/hooks/useRidePickupPin";
import { usePassengerRideLive } from "@/hooks/usePassengerRideLive";
import { useAuth } from "@/lib/auth-context";
import {
  cancelPassengerRide,
  fmtElapsed,
  haversineKm,
  isSearchingStatus,
  isWaitingStatus,
  STATUS_LABEL,
  type Ride,
} from "@/lib/passenger-rides";

export const Route = createFileRoute("/_authenticated/passenger/ride/$rideId")({
  component: RideView,
});

function RideView() {
  const { rideId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { ride, driver, driverProfile, driverLoc, locError, loading } = usePassengerRideLive(rideId);
  const { pin } = useRidePickupPin(rideId, ride?.tariff === "kids");
  const { pin: dropoffPin } = useRideDropoffPin(rideId, ride?.tariff === "kids");
  const [now, setNow] = useState(() => Date.now());
  const [rating, setRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (ride?.status === "no_drivers") {
      const timerId = window.setTimeout(
        () => void navigate({ to: "/passenger", replace: true }),
        4000,
      );
      return () => window.clearTimeout(timerId);
    }
  }, [ride?.status, navigate]);

  useEffect(() => {
    if (!ride || !isWaitingStatus(ride.status)) return;
    void navigate({
      to: "/passenger/ride/$rideId/waiting",
      params: { rideId: ride.id },
      replace: true,
    });
  }, [ride, navigate]);

  useEffect(() => {
    if (!ride || !user) return;
    const shouldPromptRating =
      ride.status === "completed" &&
      user.id === ride.passenger_id &&
      ride.driver_rating == null;
    setRatingDialogOpen(shouldPromptRating);
  }, [ride, user]);

  async function submitRating() {
    if (!ride || rating < 1) return;
    setSubmittingRating(true);
    try {
      const { error } = await supabase.rpc("rate_ride", { _ride_id: ride.id, _rating: rating });
      if (error) throw error;
      toast.success("Спасибо за оценку!");
      setRatingDialogOpen(false);
      void navigate({ to: "/passenger", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось");
    } finally {
      setSubmittingRating(false);
    }
  }

  async function cancel() {
    if (!ride || !user || cancelling) return;
    setCancelling(true);
    try {
      const { error } = await cancelPassengerRide(ride.id, user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.info("Поездка отменена");
      void navigate({ to: "/passenger", replace: true });
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ride) {
    return <div className="text-center text-muted-foreground">Поездка не найдена.</div>;
  }

  if (isSearchingStatus(ride.status)) {
    return <SearchingScreen ride={ride} onCancel={cancel} cancelling={cancelling} />;
  }

  if (isWaitingStatus(ride.status)) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const markers: MapMarker[] = [
    { id: "pickup", lat: ride.pickup_lat, lng: ride.pickup_lng, color: "#16a34a", label: "A" },
    { id: "dropoff", lat: ride.dropoff_lat, lng: ride.dropoff_lng, color: "#2563eb", label: "B" },
  ];
  if (driverLoc) {
    markers.push({
      id: "driver",
      lat: driverLoc.lat,
      lng: driverLoc.lng,
      color: "#f59e0b",
      label: "C",
    });
  }

  const liveDistanceKm =
    driverLoc && ride.status === "in_progress"
      ? haversineKm(
          { lat: driverLoc.lat, lng: driverLoc.lng },
          { lat: ride.dropoff_lat, lng: ride.dropoff_lng },
        )
      : null;
  const liveEtaMin = liveDistanceKm != null ? Math.max(1, Math.round(liveDistanceKm * 2)) : null;
  const locAgeSec = driverLoc
    ? Math.max(0, Math.floor((now - new Date(driverLoc.updated_at).getTime()) / 1000))
    : null;
  const staleLoc = locAgeSec != null && locAgeSec > 20;
  const liveText =
    locError ??
    (locAgeSec == null
      ? "Ожидаем первую геопозицию водителя"
      : locAgeSec < 5
        ? "Машина движется в реальном времени"
        : locAgeSec < 60
          ? `Обновлено ${locAgeSec} сек назад`
          : `Обновлено ${Math.floor(locAgeSec / 60)} мин назад`);
  const livePolyline =
    ride.status === "in_progress" && driverLoc
      ? [
          [driverLoc.lng, driverLoc.lat] as [number, number],
          [ride.dropoff_lng, ride.dropoff_lat] as [number, number],
        ]
      : undefined;
  const tariffName =
    TARIFFS[(ride.tariff as keyof typeof TARIFFS) ?? "standard"]?.name ?? "Стандарт";

  return (
    <div className="space-y-4">
      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Поездка завершена</DialogTitle>
            <DialogDescription>
              Оцените водителя, если хотите. Пропуск не повлияет на его рейтинг.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Card className="p-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Ваш водитель</div>
                <div className="mt-1 font-semibold">
                  {[driverProfile?.last_name, driverProfile?.first_name]
                    .filter(Boolean)
                    .join(" ") ||
                    driverProfile?.full_name ||
                    "Водитель"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[driver?.vehicle_make, driver?.vehicle_model, driver?.vehicle_plate]
                    .filter(Boolean)
                    .join(" · ") || "Данные автомобиля"}
                </div>
              </div>
            </Card>
            <div className="flex justify-center">
              <StarRating value={rating} onChange={setRating} size={42} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setRatingDialogOpen(false);
                void navigate({ to: "/passenger", replace: true });
              }}
              disabled={submittingRating}
            >
              Пропустить
            </Button>
            <Button disabled={rating < 1 || submittingRating} onClick={submitRating}>
              {submittingRating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Отправить оценку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(ride.status === "in_progress" || (ride.status !== "completed" && !!driverLoc)) && (
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/95 to-primary/70 p-5 text-primary-foreground shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
                <Car className="h-4 w-4" />
                <span>
                  {ride.status === "in_progress"
                    ? "Пассажирская поездка идет прямо сейчас"
                    : "Водитель отображается на карте вживую"}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold">
                {liveEtaMin != null ? `~${liveEtaMin} мин до точки B` : "Live tracking"}
              </h1>
              <p className="mt-1 text-sm text-primary-foreground/80">{liveText}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
              <div className="text-[10px] uppercase tracking-wide text-primary-foreground/70">
                Статус
              </div>
              <div className="mt-1 text-sm font-semibold">{STATUS_LABEL[ride.status]}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <LiveMetric
              label="До точки B"
              value={liveDistanceKm != null ? `${liveDistanceKm.toFixed(1)} км` : "—"}
            />
            <LiveMetric
              label="Обновление"
              value={locAgeSec != null ? `${locAgeSec} сек` : "—"}
            />
            <LiveMetric label="Тариф" value={tariffName} />
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-primary-foreground/85">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                locError ? "bg-red-300" : staleLoc ? "bg-yellow-300" : "bg-emerald-300"
              }`}
            />
            <span>
              {locError
                ? "Связь с геопозицией водителя временно нестабильна"
                : "Положение машины обновляется автоматически"}
            </span>
          </div>
        </Card>
      )}

      <div className="overflow-hidden rounded-xl border">
        <MapGL
          className="h-64 w-full sm:h-72"
          markers={markers}
          center={
            driverLoc
              ? { lat: driverLoc.lat, lng: driverLoc.lng }
              : { lat: ride.pickup_lat, lng: ride.pickup_lng }
          }
          zoom={13}
          polyline={livePolyline}
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={ride.status === "completed" ? "default" : "secondary"}>
            {STATUS_LABEL[ride.status]}
          </Badge>
          <span className="shrink-0 text-xs text-muted-foreground">#{ride.id.slice(0, 8)}</span>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <Row
            label="Откуда"
            value={
              ride.pickup_address || `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`
            }
          />
          <Row
            label="Куда"
            value={
              ride.dropoff_address ||
              `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`
            }
          />
          {ride.fare_amount != null && <Row label="Стоимость" value={`${ride.fare_amount} ₸`} />}
          {ride.driver_id && driverLoc && (
            <Row
              label="Обновлено"
              value={new Date(driverLoc.updated_at).toLocaleTimeString("ru-RU")}
            />
          )}
        </div>
      </Card>

      {ride.tariff === "kids" && (
        <ChildRidePinCard
          childName={ride.child_name}
          childBirthDate={ride.child_birth_date}
          pickupPin={pin}
          dropoffPin={dropoffPin}
          recipientFullName={ride.recipient_full_name}
          recipientPhone={ride.recipient_phone}
          recipientRelation={ride.recipient_relation}
          verifiedAt={ride.pickup_pin_verified_at}
          dropoffVerifiedAt={ride.dropoff_pin_verified_at}
        />
      )}

      {ride.driver_id && (driver || driverProfile) && (
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ваш водитель
          </div>
          <UserBadgeCard
            userId={ride.driver_id}
            name={
              [driverProfile?.last_name, driverProfile?.first_name].filter(Boolean).join(" ") ||
              driverProfile?.full_name ||
              "Водитель"
            }
            rating={driver?.rating ?? null}
            subtitle={
              [driver?.vehicle_make, driver?.vehicle_model, driver?.vehicle_plate]
                .filter(Boolean)
                .join(" · ") || null
            }
            size="md"
          />
        </Card>
      )}

      {ride.status === "in_progress" && <TripSafetyCard />}

      {ride.status === "completed" && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => void navigate({ to: "/passenger", replace: true })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> На главную
        </Button>
      )}
    </div>
  );
}

function ChildRidePinCard({
  childName,
  childBirthDate,
  pickupPin,
  dropoffPin,
  recipientFullName,
  recipientPhone,
  recipientRelation,
  verifiedAt,
  dropoffVerifiedAt,
}: {
  childName: string | null;
  childBirthDate: string | null;
  pickupPin: string | null;
  dropoffPin: string | null;
  recipientFullName: string | null;
  recipientPhone: string | null;
  recipientRelation: string | null;
  verifiedAt: string | null;
  dropoffVerifiedAt: string | null;
}) {
  return (
    <Card className="border-primary/20 bg-primary/5 p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">
        Детский тариф
      </div>
      <div className="mt-2 text-lg font-semibold">{childName || "Ребёнок в поездке"}</div>
      <div className="mt-1 text-sm text-muted-foreground">
        {childBirthDate
          ? `Дата рождения: ${new Date(childBirthDate).toLocaleDateString("ru-RU")}`
          : "Мама должна проводить ребёнка до машины."}
      </div>
      <div className="mt-3 rounded-xl border border-primary/20 bg-background p-4 text-sm">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Получатель в точке B
        </div>
        <div className="mt-2 font-semibold">{recipientFullName || "Не указан"}</div>
        <div className="mt-1 text-muted-foreground">
          {[recipientRelation, recipientPhone].filter(Boolean).join(" · ") ||
            "Данные получателя появятся здесь"}
        </div>
      </div>
      {pickupPin && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-background p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            PIN для начала поездки
          </div>
          <div className="mt-2 text-3xl font-bold tracking-[0.35em] text-primary">{pickupPin}</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Сообщите этот код водителю после того, как он подъедет.
          </div>
          {verifiedAt && (
            <div className="mt-2 text-xs text-emerald-600">
              Код подтверждён {new Date(verifiedAt).toLocaleTimeString("ru-RU")}.
            </div>
          )}
        </div>
      )}
      {dropoffPin && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-background p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            PIN для передачи в точке B
          </div>
          <div className="mt-2 text-3xl font-bold tracking-[0.35em] text-primary">{dropoffPin}</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Этот код должен назвать получатель ребёнка в конце поездки.
          </div>
          {dropoffVerifiedAt && (
            <div className="mt-2 text-xs text-emerald-600">
              Передача подтверждена {new Date(dropoffVerifiedAt).toLocaleTimeString("ru-RU")}.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function LiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-primary-foreground/70">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

const SEARCH_MESSAGES = [
  "Ищем ближайшего водителя…",
  "Отправляем запрос подходящим водителям рядом",
  "Подбираем оптимальный вариант для вас",
  "Чуть-чуть терпения — почти нашли",
  "Расширяем зону поиска…",
];

function searchRadiusKm(elapsedSec: number): number {
  const km = 1.5 + Math.floor(elapsedSec / 15) * 0.5;
  return Math.min(8, km);
}

function estimatedPickupMin(elapsedSec: number): number {
  const base = 4 + Math.floor(elapsedSec / 30);
  return Math.min(12, base);
}

function SearchingScreen({
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
  const radiusKm = searchRadiusKm(elapsed);
  const etaMin = estimatedPickupMin(elapsed);
  const radiusPct = Math.min(100, Math.round((radiusKm / 8) * 100));

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
              <div className="mt-0.5 text-base font-semibold tabular-nums">
                ~{radiusKm.toFixed(1)} км
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-primary-foreground/20">
                <div
                  className="h-full bg-primary-foreground transition-all duration-700 ease-out"
                  style={{ width: `${radiusPct}%` }}
                />
              </div>
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
            <Stat icon={<RouteIcon className="h-3.5 w-3.5" />} label="Тариф" value={tariff.name} />
            <Stat
              icon={<Clock className="h-3.5 w-3.5" />}
              label="В пути"
              value={ride.duration_min != null ? `${ride.duration_min} мин` : "—"}
            />
            <Stat
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

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
