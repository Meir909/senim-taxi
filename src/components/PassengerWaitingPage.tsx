import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Route as RouteIcon,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DriverCallButton } from "@/components/DriverCallButton";
import { MapGL, type MapMarker } from "@/components/MapGL";
import { TripSafetyCard } from "@/components/TripSafetyPanel";
import { UserBadgeCard } from "@/components/UserBadgeCard";
import { TARIFFS, fmtKzt } from "@/lib/fare";
import {
  fmtElapsed,
  haversineKm,
  type Driver,
  type Loc,
  type Profile,
  type Ride,
} from "@/lib/passenger-rides";

type Props = {
  ride: Ride;
  pickupPin?: string | null;
  dropoffPin?: string | null;
  driver: Driver | null;
  driverProfile: Profile | null;
  driverLoc: Loc | null;
  locError: string | null;
  cancelling?: boolean;
  onCancel: () => void | Promise<void>;
  backToRide?: boolean;
};

export function PassengerWaitingPage({
  ride,
  pickupPin,
  dropoffPin,
  driver,
  driverProfile,
  driverLoc,
  locError,
  cancelling,
  onCancel,
  backToRide = true,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const timerId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const startedAt = useMemo(
    () => new Date(ride.accepted_at ?? ride.requested_at).getTime(),
    [ride.accepted_at, ride.requested_at],
  );

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const distanceKm = driverLoc
    ? haversineKm(
        { lat: driverLoc.lat, lng: driverLoc.lng },
        { lat: ride.pickup_lat, lng: ride.pickup_lng },
      )
    : null;
  const etaMin = distanceKm != null ? Math.max(1, Math.round(distanceKm * 2)) : null;
  const locAgeSec = driverLoc
    ? Math.max(0, Math.floor((now - new Date(driverLoc.updated_at).getTime()) / 1000))
    : null;
  const stale = locAgeSec != null && locAgeSec > 20;
  const freshness =
    locAgeSec == null
      ? "ожидаем координаты…"
      : locAgeSec < 5
        ? "только что"
        : locAgeSec < 60
          ? `${locAgeSec} сек назад`
          : `${Math.floor(locAgeSec / 60)} мин назад`;

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

  const tariff = TARIFFS[(ride.tariff as keyof typeof TARIFFS) ?? "standard"] ?? TARIFFS.standard;
  const driverName =
    [driverProfile?.last_name, driverProfile?.first_name].filter(Boolean).join(" ") ||
    driverProfile?.full_name ||
    "Водитель";
  const car = [driver?.vehicle_make, driver?.vehicle_model].filter(Boolean).join(" ");
  const headline =
    ride.status === "driver_arrived"
      ? "Водитель ждёт вас"
      : ride.status === "driver_arriving"
        ? "Водитель в пути к вам"
        : "Водитель принял заказ";
  const subline =
    ride.status === "driver_arrived"
      ? "Подойдите к машине — водитель уже на месте подачи."
      : ride.status === "driver_arriving"
        ? "Машина едет к точке подачи. Пожалуйста, будьте готовы."
        : "Водитель назначен и скоро отправится к вам.";
  const Icon = ride.status === "driver_arrived" ? CheckCircle2 : Car;
  const canCancel = ride.status !== "driver_arrived";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {backToRide ? (
          <Link
            to="/passenger/ride/$rideId"
            params={{ rideId: ride.id }}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> К заказу
          </Link>
        ) : (
          <div className="text-sm text-muted-foreground">Ожидание водителя</div>
        )}
        <Badge variant="outline">#{ride.id.slice(0, 8)}</Badge>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <MapGL
          className="h-56 w-full sm:h-72"
          markers={markers}
          center={
            driverLoc
              ? { lat: driverLoc.lat, lng: driverLoc.lng }
              : { lat: ride.pickup_lat, lng: ride.pickup_lng }
          }
          zoom={13}
          fitMarkers
        />
      </div>

      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/70 p-6 text-primary-foreground shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="relative grid h-20 w-20 place-items-center">
            {ride.status !== "driver_arrived" && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full bg-primary-foreground/30" />
                <span className="absolute inset-2 animate-pulse rounded-full bg-primary-foreground/20" />
              </>
            )}
            <Icon className="relative h-10 w-10" />
          </div>
          <div className="mt-4 text-xl font-bold">{headline}</div>
          <div className="mt-1 text-sm opacity-95">{subline}</div>
          <div className="mt-3 text-3xl font-bold tabular-nums">{fmtElapsed(elapsed)}</div>
          <div className="text-[11px] uppercase tracking-wide opacity-80">с момента назначения</div>

          <div className="mt-4 grid w-full grid-cols-2 gap-2">
            <InfoTile
              label="До вас"
              value={distanceKm != null ? `~${distanceKm.toFixed(1)} км` : "—"}
            />
            <InfoTile
              label="ETA подачи"
              value={
                ride.status === "driver_arrived"
                  ? "на месте"
                  : etaMin != null
                    ? `~${etaMin} мин`
                    : "—"
              }
            />
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] opacity-90">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                locError
                  ? "bg-destructive animate-pulse"
                  : stale
                    ? "bg-warning"
                    : "bg-emerald-300 animate-pulse"
              }`}
            />
            <span>
              {locError
                ? locError
                : driverLoc
                  ? `Координаты обновлены ${freshness}`
                  : "Ожидаем координаты водителя…"}
            </span>
          </div>
        </div>
      </Card>

      {(driver || driverProfile) && (
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ваш водитель
          </div>
          <UserBadgeCard
            userId={ride.driver_id!}
            name={driverName}
            rating={driver?.rating ?? null}
            subtitle={[car, driver?.vehicle_plate].filter(Boolean).join(" · ") || null}
            size="md"
          />
          {driverProfile?.phone && (
            <div className="mt-3">
              <DriverCallButton phone={driverProfile.phone} />
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Детали заказа
        </div>
        <div className="space-y-3 text-sm">
          <AddressRow
            label="Откуда"
            value={
              ride.pickup_address || `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`
            }
            color="text-success"
          />
          <AddressRow
            label="Куда"
            value={
              ride.dropoff_address ||
              `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`
            }
            color="text-primary"
          />
          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <Stat icon={<RouteIcon className="h-3.5 w-3.5" />} label="Тариф" value={tariff.name} />
            <Stat
              icon={<Clock className="h-3.5 w-3.5" />}
              label="В пути"
              value={ride.duration_min != null ? `${ride.duration_min} мин` : "—"}
            />
            <Stat
              label="Цена"
              value={
                ride.estimated_fare != null
                  ? fmtKzt(Number(ride.estimated_fare))
                  : ride.fare_amount != null
                    ? `${ride.fare_amount} ₸`
                    : "—"
              }
            />
          </div>
        </div>
      </Card>

      {ride.tariff === "kids" && (
        <Card className="border-primary/20 bg-primary/5 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
            Детский тариф
          </div>
          <div className="mt-2 text-lg font-semibold">
            {ride.child_name || "Поездка для ребёнка"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Мама должна проводить ребёнка до машины и назвать PIN водителю.
          </div>
          <div className="mt-3 rounded-xl border border-primary/20 bg-background p-4 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Получатель в точке B
            </div>
            <div className="mt-2 font-semibold">{ride.recipient_full_name || "Не указан"}</div>
            <div className="mt-1 text-muted-foreground">
              {[ride.recipient_relation, ride.recipient_phone].filter(Boolean).join(" · ") ||
                "Данные получателя отсутствуют"}
            </div>
          </div>
          {pickupPin && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-background p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">PIN-код</div>
              <div className="mt-2 text-3xl font-bold tracking-[0.35em] text-primary">
                {pickupPin}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Водитель сможет начать поездку только после правильного ввода этого кода.
              </div>
              {ride.pickup_pin_verified_at && (
                <div className="mt-2 text-xs text-emerald-600">
                  Код уже подтверждён{" "}
                  {new Date(ride.pickup_pin_verified_at).toLocaleTimeString("ru-RU")}.
                </div>
              )}
            </div>
          )}
          {dropoffPin && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-background p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                PIN для передачи ребёнка
              </div>
              <div className="mt-2 text-3xl font-bold tracking-[0.35em] text-primary">
                {dropoffPin}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Получатель должен назвать этот код водителю в конце поездки.
              </div>
              {ride.dropoff_pin_verified_at && (
                <div className="mt-2 text-xs text-emerald-600">
                  Передача уже подтверждена{" "}
                  {new Date(ride.dropoff_pin_verified_at).toLocaleTimeString("ru-RU")}.
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <TripSafetyCard />

      {canCancel &&
        (confirmCancel ? (
          <Card className="space-y-3 p-4">
            <p className="text-sm">Отменить заказ? Водитель будет уведомлён.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={cancelling}
                onClick={() => setConfirmCancel(false)}
              >
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
        ))}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-primary-foreground/15 px-3 py-2 text-left">
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function AddressRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-start gap-3">
      <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
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
