import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowLeft, MapPin, Clock, Route as RouteIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const { ride, driver, driverProfile, driverLoc, loading } = usePassengerRideLive(rideId);
  const { pin } = useRidePickupPin(rideId, ride?.tariff === "kids");
  const { pin: dropoffPin } = useRideDropoffPin(rideId, ride?.tariff === "kids");
  const [rating, setRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

  async function submitRating() {
    if (!ride || rating < 1) return;
    setSubmittingRating(true);
    try {
      const { error } = await supabase.rpc("rate_ride", { _ride_id: ride.id, _rating: rating });
      if (error) throw error;
      toast.success("Спасибо за оценку!");
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

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border">
        <MapGL
          className="h-64 w-full sm:h-72"
          markers={markers}
          center={{ lat: ride.pickup_lat, lng: ride.pickup_lng }}
          zoom={13}
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

      {ride.status === "completed" &&
        user?.id === ride.passenger_id &&
        ride.driver_rating == null && (
          <Card className="p-5">
            <h3 className="text-center font-semibold">Оцените водителя</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Ваш отзыв поможет другим пассажирам.
            </p>
            <div className="mt-4 flex justify-center">
              <StarRating value={rating} onChange={setRating} size={40} />
            </div>
            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={rating < 1 || submittingRating}
              onClick={submitRating}
            >
              {submittingRating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Отправить
              оценку
            </Button>
          </Card>
        )}

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
