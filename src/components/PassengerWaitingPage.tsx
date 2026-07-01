import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Clock3,
  Loader2,
  Navigation,
  Route as RouteIcon,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DriverCallButton } from "@/components/DriverCallButton";
import { MapGL, type MapMarker } from "@/components/MapGL";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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

  const freshnessText =
    locError ??
    (locAgeSec == null
      ? "Ожидаем координаты водителя"
      : locAgeSec < 5
        ? "Координаты обновлены только что"
        : locAgeSec < 60
          ? `Координаты обновлены ${locAgeSec} сек назад`
          : `Координаты обновлены ${Math.floor(locAgeSec / 60)} мин назад`);

  const markers: MapMarker[] = [
    { id: "pickup", lat: ride.pickup_lat, lng: ride.pickup_lng, color: "#22c55e", label: "A" },
    { id: "dropoff", lat: ride.dropoff_lat, lng: ride.dropoff_lng, color: "#3b82f6", label: "B" },
  ];

  if (driverLoc) {
    markers.push({
      id: "driver",
      lat: driverLoc.lat,
      lng: driverLoc.lng,
      color: "#f59e0b",
    });
  }

  const tariff = TARIFFS[(ride.tariff as keyof typeof TARIFFS) ?? "standard"] ?? TARIFFS.standard;
  const driverName =
    [driverProfile?.last_name, driverProfile?.first_name].filter(Boolean).join(" ") ||
    driverProfile?.full_name ||
    "Водитель";
  const carTitle = [driver?.vehicle_make, driver?.vehicle_model].filter(Boolean).join(" ");
  const carSubtitle = [driver?.vehicle_plate, driver?.vehicle_color].filter(Boolean).join(" · ");

  const headline =
    ride.status === "driver_arrived"
      ? "Водитель уже на месте"
      : ride.status === "driver_arriving"
        ? "Водитель едет к точке подачи"
        : "Заказ принят водителем";
  const subline =
    ride.status === "driver_arrived"
      ? "Подойдите к машине в точке A."
      : ride.status === "driver_arriving"
        ? "Следите за движением машины на карте."
        : "Сейчас водитель подтвердил поездку и выезжает к вам.";
  const StatusIcon = ride.status === "driver_arrived" ? CheckCircle2 : Car;
  const canCancel = ride.status !== "driver_arrived";

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        {backToRide ? (
          <Link
            to="/passenger/ride/$rideId"
            params={{ rideId: ride.id }}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> К поездке
          </Link>
        ) : (
          <div className="text-sm text-muted-foreground">Ожидание водителя</div>
        )}
        <Badge variant="outline">#{ride.id.slice(0, 8)}</Badge>
      </div>

      <Card className="overflow-hidden border-0 bg-gradient-to-br from-foreground to-foreground/85 p-5 text-background shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-background/80">
              <StatusIcon className="h-4 w-4" />
              <span>{headline}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold">{etaMin != null ? `~${etaMin} мин` : "—"}</h1>
            <p className="mt-1 text-sm text-background/80">{subline}</p>
          </div>
          <div className="rounded-2xl bg-background/10 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wide text-background/70">Ожидание</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{fmtElapsed(elapsed)}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MetricCard label="До вас" value={distanceKm != null ? `${distanceKm.toFixed(1)} км` : "—"} />
          <MetricCard label="Тариф" value={tariff.name} />
          <MetricCard
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

        <div className="mt-4 flex items-center gap-2 text-xs text-background/80">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              locError ? "bg-red-300" : stale ? "bg-yellow-300" : "bg-emerald-300"
            }`}
          />
          <span>{freshnessText}</span>
        </div>
      </Card>
      <div className="overflow-hidden rounded-2xl border shadow-sm">
        <MapGL
          className="h-64 w-full sm:h-80"
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

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <RouteIcon className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Маршрут поездки</h2>
        </div>
        <div className="space-y-4">
          <RouteStop
            badge="A"
            title="Точка подачи"
            value={
              ride.pickup_address || `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`
            }
            accent="bg-emerald-500"
          />
          <div className="ml-5 border-l border-dashed border-border pl-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              <span>
                {ride.duration_min != null ? `${ride.duration_min} мин в пути` : "Время уточняется"}
              </span>
              <span className="text-border">•</span>
              <span>
                {ride.distance_km != null ? `${ride.distance_km} км` : "Дистанция уточняется"}
              </span>
            </div>
          </div>
          <RouteStop
            badge="B"
            title="Точка назначения"
            value={
              ride.dropoff_address ||
              `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`
            }
            accent="bg-blue-500"
          />
        </div>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" className="mt-4 w-full">
              Полные детали заказа
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[88dvh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Детали заказа от А до Я</DrawerTitle>
              <DrawerDescription>
                Вся информация по поездке, адресам, водителю и особым условиям.
              </DrawerDescription>
            </DrawerHeader>
            <div className="space-y-4 overflow-y-auto px-4 pb-6">
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Статус заказа
                    </div>
                    <div className="mt-1 text-lg font-semibold">{headline}</div>
                  </div>
                  <Badge variant="outline">#{ride.id.slice(0, 8)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <DetailStat label="Тариф" value={tariff.name} />
                  <DetailStat label="Ожидание" value={fmtElapsed(elapsed)} />
                  <DetailStat
                    label="До подачи"
                    value={etaMin != null ? `~${etaMin} мин` : "—"}
                  />
                  <DetailStat
                    label="Стоимость"
                    value={
                      ride.estimated_fare != null
                        ? fmtKzt(Number(ride.estimated_fare))
                        : ride.fare_amount != null
                          ? `${ride.fare_amount} ₸`
                          : "—"
                    }
                  />
                </div>
              </Card>

              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Адреса поездки</div>
                <div className="space-y-4">
                  <RouteStop
                    badge="A"
                    title="Полный адрес подачи"
                    value={
                      ride.pickup_address ||
                      `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`
                    }
                    accent="bg-emerald-500"
                  />
                  <div className="ml-5 border-l border-dashed border-border pl-5">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>Координаты A: {ride.pickup_lat.toFixed(6)}, {ride.pickup_lng.toFixed(6)}</div>
                      <div>
                        Маршрут: {ride.distance_km != null ? `${ride.distance_km} км` : "—"} ·{" "}
                        {ride.duration_min != null ? `${ride.duration_min} мин` : "—"}
                      </div>
                    </div>
                  </div>
                  <RouteStop
                    badge="B"
                    title="Полный адрес назначения"
                    value={
                      ride.dropoff_address ||
                      `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`
                    }
                    accent="bg-blue-500"
                  />
                  <div className="ml-11 text-xs text-muted-foreground">
                    Координаты B: {ride.dropoff_lat.toFixed(6)}, {ride.dropoff_lng.toFixed(6)}
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Водитель и машина</div>
                <div className="space-y-3">
                  <InfoLine
                    icon={<UserRound className="h-4 w-4" />}
                    label="Водитель"
                    value={driverName}
                  />
                  <InfoLine
                    icon={<Car className="h-4 w-4" />}
                    label="Автомобиль"
                    value={carTitle || "Данные обновляются"}
                  />
                  <InfoLine
                    icon={<Navigation className="h-4 w-4" />}
                    label="Номер и цвет"
                    value={carSubtitle || "Данные обновляются"}
                  />
                  <InfoLine
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Обновление геопозиции"
                    value={freshnessText}
                  />
                  {driverProfile?.phone && (
                    <InfoLine
                      icon={<Phone className="h-4 w-4" />}
                      label="Телефон"
                      value={driverProfile.phone}
                    />
                  )}
                </div>
              </Card>

              {ride.tariff === "kids" && (
                <Card className="p-4">
                  <div className="mb-3 text-sm font-semibold">Особые условия детской поездки</div>
                  <div className="space-y-3">
                    <InfoLine
                      icon={<Shield className="h-4 w-4" />}
                      label="Ребёнок"
                      value={ride.child_name || "Не указан"}
                    />
                    <InfoLine
                      icon={<UserRound className="h-4 w-4" />}
                      label="Получатель"
                      value={ride.recipient_full_name || "Не указан"}
                    />
                    <InfoLine
                      icon={<Phone className="h-4 w-4" />}
                      label="Телефон получателя"
                      value={ride.recipient_phone || "Не указан"}
                    />
                    <InfoLine
                      icon={<Shield className="h-4 w-4" />}
                      label="Кем приходится"
                      value={ride.recipient_relation || "Не указано"}
                    />
                  </div>
                  {pickupPin && (
                    <PinCard
                      title="PIN для посадки"
                      code={pickupPin}
                      desc="Этот код мама называет водителю перед началом поездки."
                      verifiedAt={ride.pickup_pin_verified_at}
                    />
                  )}
                  {dropoffPin && (
                    <PinCard
                      title="PIN для передачи ребёнка"
                      code={dropoffPin}
                      desc="Этот код получатель называет водителю в конце поездки."
                      verifiedAt={ride.dropoff_pin_verified_at}
                    />
                  )}
                </Card>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </Card>

      {(driver || driverProfile) && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Детали водителя</h2>
          </div>
          <UserBadgeCard
            userId={ride.driver_id!}
            name={driverName}
            rating={driver?.rating ?? null}
            subtitle={[carTitle, carSubtitle].filter(Boolean).join(" · ") || null}
            size="md"
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <InfoLine
              icon={<Car className="h-4 w-4" />}
              label="Автомобиль"
              value={carTitle || "Данные обновляются"}
            />
            <InfoLine
              icon={<Navigation className="h-4 w-4" />}
              label="Госномер"
              value={driver?.vehicle_plate || "—"}
            />
          </div>
          {driverProfile?.phone && (
            <div className="mt-4">
              <DriverCallButton phone={driverProfile.phone} />
            </div>
          )}
        </Card>
      )}

      {ride.tariff === "kids" && (
        <Card className="border-primary/20 bg-primary/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Детская поездка</h2>
          </div>
          <div className="rounded-xl border border-primary/20 bg-background p-4">
            <div className="text-sm font-semibold">{ride.child_name || "Поездка для ребёнка"}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {[ride.recipient_full_name, ride.recipient_relation, ride.recipient_phone]
                .filter(Boolean)
                .join(" · ") || "Получатель пока не указан"}
            </div>
          </div>
          {pickupPin && (
            <PinCard
              title="PIN для посадки"
              code={pickupPin}
              desc="Назовите этот PIN водителю у машины."
              verifiedAt={ride.pickup_pin_verified_at}
            />
          )}
          {dropoffPin && (
            <PinCard
              title="PIN для передачи ребёнка"
              code={dropoffPin}
              desc="Этот PIN получатель называет водителю в конце поездки."
              verifiedAt={ride.dropoff_pin_verified_at}
            />
          )}
        </Card>
      )}

      <TripSafetyCard />

      {canCancel &&
        (confirmCancel ? (
          <Card className="space-y-3 p-4">
            <p className="text-sm">Отменить заказ? Водитель получит уведомление сразу.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={cancelling}
                onClick={() => setConfirmCancel(false)}
              >
                Вернуться
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/10 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wide text-background/70">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function RouteStop({
  badge,
  title,
  value,
  accent,
}: {
  badge: string;
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${accent}`}
      >
        {badge}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
        <div className="mt-1 text-sm font-medium leading-5">{value}</div>
      </div>
    </div>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function PinCard({
  title,
  code,
  desc,
  verifiedAt,
}: {
  title: string;
  code: string;
  desc: string;
  verifiedAt: string | null;
}) {
  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-background p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-2 text-3xl font-bold tracking-[0.35em] text-primary">{code}</div>
      <div className="mt-2 text-sm text-muted-foreground">{desc}</div>
      {verifiedAt && (
        <div className="mt-2 text-xs text-emerald-600">
          Подтверждено {new Date(verifiedAt).toLocaleTimeString("ru-RU")}
        </div>
      )}
    </div>
  );
}
