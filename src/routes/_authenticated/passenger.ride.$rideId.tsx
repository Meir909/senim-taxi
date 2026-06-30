import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, X, ArrowLeft, MapPin, Clock, Route as RouteIcon, Car, CheckCircle2, Phone } from "lucide-react";
import { MapGL, type MapMarker } from "@/components/MapGL";
import { StarRating } from "@/components/StarRating";
import { UserBadgeCard } from "@/components/UserBadgeCard";
import { TARIFFS, fmtKzt } from "@/lib/fare";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type Ride = Database["public"]["Tables"]["rides"]["Row"];
type Loc = Database["public"]["Tables"]["driver_locations"]["Row"];

export const Route = createFileRoute("/_authenticated/passenger/ride/$rideId")({
  component: RideView,
});

const STATUS_LABEL: Record<Ride["status"], string> = {
  requested: "Создаём заказ…",
  searching: "Ищем водителя…",
  accepted: "Водитель назначен",
  driver_arriving: "Водитель в пути",
  driver_arrived: "Водитель прибыл",
  in_progress: "В пути",
  completed: "Завершено",
  cancelled: "Отменено",
  no_drivers: "Нет свободных водителей",
};

function RideView() {
  const { rideId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverLoc, setDriverLoc] = useState<Loc | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [driverProfile, setDriverProfile] = useState<Profile | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from("rides").select("*").eq("id", rideId).maybeSingle();
      if (!mounted) return;
      setRide(data);
      setLoading(false);
    })();
    const ch = supabase
      .channel(`ride-${rideId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` },
        (p) => setRide(p.new as Ride))
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [rideId]);

  useEffect(() => {
    if (!ride?.driver_id) { setDriver(null); setDriverProfile(null); setDriverLoc(null); setLocError(null); return; }
    const driverId = ride.driver_id;
    let mounted = true;
    let attempt = 0;
    let retryTimer: number | undefined;
    let pollTimer: number | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function fetchLoc(): Promise<Loc | null> {
      const { data, error } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("driver_id", driverId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    async function loadAll() {
      try {
        const [loc, { data: d }, { data: p }] = await Promise.all([
          fetchLoc(),
          supabase.from("drivers").select("*").eq("id", driverId).maybeSingle(),
          supabase.from("profiles").select("*").eq("id", driverId).maybeSingle(),
        ]);
        if (!mounted) return;
        setDriverLoc(loc);
        setDriver(d);
        setDriverProfile(p);
        setLocError(null);
        attempt = 0;
      } catch (err) {
        if (!mounted) return;
        setLocError(err instanceof Error ? err.message : "Не удалось получить координаты");
        // Backoff: 1.5s, 3s, 6s, 12s, cap 20s
        const delay = Math.min(20_000, 1500 * 2 ** attempt);
        attempt += 1;
        retryTimer = window.setTimeout(loadAll, delay);
      }
    }

    async function refetchLoc() {
      try {
        const loc = await fetchLoc();
        if (!mounted) return;
        setDriverLoc(loc);
        setLocError(null);
      } catch (err) {
        if (!mounted) return;
        setLocError(err instanceof Error ? err.message : "Связь с водителем нестабильна");
      }
    }

    function subscribe() {
      channel = supabase
        .channel(`driver-loc-${driverId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
          (payload) => {
            setDriverLoc(payload.new as Loc);
            setLocError(null);
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setLocError("Переподключение к обновлениям…");
            if (channel) supabase.removeChannel(channel);
            channel = null;
            window.setTimeout(() => { if (mounted) subscribe(); }, 2500);
          }
        });
    }

    void loadAll();
    subscribe();
    // Polling fallback (in case realtime drops silently)
    pollTimer = window.setInterval(() => { void refetchLoc(); }, 8000);

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [ride?.driver_id]);


  const [rating, setRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (ride && ride.status === "no_drivers") {
      const t = setTimeout(() => void navigate({ to: "/passenger", replace: true }), 4000);
      return () => clearTimeout(t);
    }
  }, [ride?.status, navigate, ride]);

  async function submitRating() {
    if (!ride || rating < 1) return;
    setSubmittingRating(true);
    try {
      const { error } = await supabase.rpc("rate_ride", { _ride_id: ride.id, _rating: rating });
      if (error) throw error;
      toast.success("Спасибо за оценку!");
      void navigate({ to: "/passenger", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось");
    } finally {
      setSubmittingRating(false);
    }
  }

  async function cancel() {
    if (!ride || !user || cancelling) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("rides")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: "passenger_cancelled" })
        .eq("id", ride.id)
        .eq("passenger_id", user.id);
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

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!ride) return <div className="text-center text-muted-foreground">Поездка не найдена.</div>;

  if (ride.status === "searching" || ride.status === "requested") {
    return <SearchingScreen ride={ride} onCancel={cancel} cancelling={cancelling} />;
  }

  if (ride.status === "accepted" || ride.status === "driver_arriving" || ride.status === "driver_arrived") {
    void navigate({
      to: "/passenger/ride/$rideId/waiting",
      params: { rideId: ride.id },
      replace: true,
    });
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }




  const canCancel = ["requested", "searching", "accepted", "driver_arriving"].includes(ride.status);

  const markers: MapMarker[] = [
    { id: "pickup", lat: ride.pickup_lat, lng: ride.pickup_lng, color: "#16a34a", label: "A" },
    { id: "dropoff", lat: ride.dropoff_lat, lng: ride.dropoff_lng, color: "#2563eb", label: "B" },
  ];
  if (driverLoc) markers.push({ id: "driver", lat: driverLoc.lat, lng: driverLoc.lng, color: "#f59e0b", label: "🚗" });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border">
        <MapGL className="h-64 w-full sm:h-72" markers={markers} center={{ lat: ride.pickup_lat, lng: ride.pickup_lng }} zoom={13} />
      </div>
      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={ride.status === "completed" ? "default" : "secondary"}>{STATUS_LABEL[ride.status]}</Badge>
          <span className="shrink-0 text-xs text-muted-foreground">#{ride.id.slice(0, 8)}</span>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <Row label="Откуда" value={ride.pickup_address || `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`} />
          <Row label="Куда" value={ride.dropoff_address || `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`} />
          {ride.fare_amount != null && <Row label="Стоимость" value={`${ride.fare_amount} ₸`} />}
          {ride.driver_id && driverLoc && (
            <Row label="Обновлено" value={new Date(driverLoc.updated_at).toLocaleTimeString("ru-RU")} />
          )}
        </div>
      </Card>

      {ride.driver_id && (driver || driverProfile) && (
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ваш водитель</div>
          <UserBadgeCard
            userId={ride.driver_id}
            name={[driverProfile?.last_name, driverProfile?.first_name].filter(Boolean).join(" ") || driverProfile?.full_name || "Водитель"}
            rating={driver?.rating ?? null}
            subtitle={[driver?.vehicle_make, driver?.vehicle_model, driver?.vehicle_plate].filter(Boolean).join(" · ") || null}
            size="md"
          />
        </Card>
      )}

      {canCancel && (
        <Button variant="outline" className="w-full" onClick={cancel}>
          <X className="mr-2 h-4 w-4" /> Отменить поездку
        </Button>
      )}



      {ride.status === "completed" && user?.id === ride.passenger_id && ride.driver_rating == null && (
        <Card className="p-5">
          <h3 className="text-center font-semibold">Оцените водителя</h3>
          <p className="mt-1 text-center text-sm text-muted-foreground">Ваш отзыв поможет другим пассажирам.</p>
          <div className="mt-4 flex justify-center">
            <StarRating value={rating} onChange={setRating} size={40} />
          </div>
          <Button className="mt-4 w-full" size="lg" disabled={rating < 1 || submittingRating} onClick={submitRating}>
            {submittingRating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Отправить оценку
          </Button>
        </Card>
      )}

      {ride.status === "completed" && (
        <Button variant="ghost" className="w-full" onClick={() => void navigate({ to: "/passenger", replace: true })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> На главную
        </Button>
      )}
    </div>
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

function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

// Search radius grows over time: starts at 1.5 km, +0.5 km каждые 15 сек, cap 8 км.
function searchRadiusKm(elapsedSec: number): number {
  const km = 1.5 + Math.floor(elapsedSec / 15) * 0.5;
  return Math.min(8, km);
}

// Грубая ETA до подачи: базовая 4 мин, растёт со временем поиска, cap 12 мин.
function estimatedPickupMin(elapsedSec: number): number {
  const base = 4 + Math.floor(elapsedSec / 30);
  return Math.min(12, base);
}

function SearchingScreen({ ride, onCancel, cancelling }: { ride: Ride; onCancel: () => void | Promise<void>; cancelling?: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const startedAt = useMemo(() => new Date(ride.requested_at).getTime(), [ride.requested_at]);

  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const i = window.setInterval(tick, 1000);
    return () => window.clearInterval(i);
  }, [startedAt]);

  useEffect(() => {
    const i = window.setInterval(() => setMsgIdx((v) => (v + 1) % SEARCH_MESSAGES.length), 3500);
    return () => window.clearInterval(i);
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
          <div className="mt-1 min-h-[2.5rem] text-sm opacity-95 transition-opacity">{SEARCH_MESSAGES[msgIdx]}</div>

          <div className="mt-4 grid w-full grid-cols-2 gap-2">
            <div className="rounded-lg bg-primary-foreground/15 px-3 py-2 text-left">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Зона поиска</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">~{radiusKm.toFixed(1)} км</div>
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
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Детали заказа</div>
          <Badge variant="outline">#{ride.id.slice(0, 8)}</Badge>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Откуда</div>
              <div className="truncate font-medium">{ride.pickup_address || `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Куда</div>
              <div className="truncate font-medium">{ride.dropoff_address || `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <Stat icon={<RouteIcon className="h-3.5 w-3.5" />} label="Тариф" value={tariff.name} />
            <Stat icon={<Clock className="h-3.5 w-3.5" />} label="В пути" value={ride.duration_min != null ? `${ride.duration_min} мин` : "—"} />
            <Stat label="Цена" value={ride.estimated_fare != null ? fmtKzt(Number(ride.estimated_fare)) : "—"} />
          </div>
        </div>
      </Card>

      {confirmCancel ? (
        <Card className="space-y-3 p-4">
          <p className="text-sm">Отменить заказ? Поиск водителя будет остановлен.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={cancelling} onClick={() => setConfirmCancel(false)}>Нет</Button>
            <Button variant="destructive" disabled={cancelling} onClick={() => void onCancel()}>
              {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
              Отменить
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="outline" className="w-full" size="lg" disabled={cancelling} onClick={() => setConfirmCancel(true)}>
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

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function AwaitingDriverScreen({
  ride,
  driver,
  driverProfile,
  driverLoc,
  locError,
  onCancel,
  cancelling,
}: {
  ride: Ride;
  driver: Driver | null;
  driverProfile: Profile | null;
  driverLoc: Loc | null;
  locError: string | null;
  onCancel: () => void | Promise<void>;
  cancelling?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [confirmCancel, setConfirmCancel] = useState(false);
  const startedAt = useMemo(
    () => new Date(ride.accepted_at ?? ride.requested_at).getTime(),
    [ride.accepted_at, ride.requested_at],
  );

  useEffect(() => {
    setNow(Date.now());
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));

  const distanceKm = driverLoc
    ? haversineKm({ lat: driverLoc.lat, lng: driverLoc.lng }, { lat: ride.pickup_lat, lng: ride.pickup_lng })
    : null;
  // ~30 км/ч в городе → 2 мин/км, минимум 1 мин
  const etaMin = distanceKm != null ? Math.max(1, Math.round(distanceKm * 2)) : null;
  const locAgeSec = driverLoc ? Math.max(0, Math.floor((now - new Date(driverLoc.updated_at).getTime()) / 1000)) : null;
  const stale = locAgeSec != null && locAgeSec > 20;
  const freshness =
    locAgeSec == null
      ? "ожидаем координаты…"
      : locAgeSec < 5
        ? "только что"
        : locAgeSec < 60
          ? `${locAgeSec} сек назад`
          : `${Math.floor(locAgeSec / 60)} мин назад`;


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
            <div className="rounded-lg bg-primary-foreground/15 px-3 py-2 text-left">
              <div className="text-[10px] uppercase tracking-wide opacity-80">До вас</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">
                {distanceKm != null ? `~${distanceKm.toFixed(1)} км` : "—"}
              </div>
            </div>
            <div className="rounded-lg bg-primary-foreground/15 px-3 py-2 text-left">
              <div className="text-[10px] uppercase tracking-wide opacity-80">ETA подачи</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">
                {ride.status === "driver_arrived" ? "на месте" : etaMin != null ? `~${etaMin} мин` : "—"}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] opacity-90">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                locError ? "bg-destructive animate-pulse" : stale ? "bg-warning" : "bg-emerald-300 animate-pulse"
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
            <a
              href={`tel:${driverProfile.phone}`}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <Phone className="h-4 w-4" /> Позвонить водителю
            </a>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Детали заказа</div>
          <Badge variant="outline">#{ride.id.slice(0, 8)}</Badge>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Откуда</div>
              <div className="truncate font-medium">
                {ride.pickup_address || `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Куда</div>
              <div className="truncate font-medium">
                {ride.dropoff_address || `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`}
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

      {canCancel && (
        confirmCancel ? (
          <Card className="space-y-3 p-4">
            <p className="text-sm">Отменить заказ? Водитель будет уведомлён.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={cancelling} onClick={() => setConfirmCancel(false)}>
                Нет
              </Button>
              <Button variant="destructive" disabled={cancelling} onClick={() => void onCancel()}>
                {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                Отменить
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="outline" className="w-full" size="lg" disabled={cancelling} onClick={() => setConfirmCancel(true)}>
            <X className="mr-2 h-4 w-4" /> Отменить заказ
          </Button>
        )
      )}
    </div>
  );
}

