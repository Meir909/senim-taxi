import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, X, ArrowLeft, MapPin, Clock, Route as RouteIcon } from "lucide-react";
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
    if (!ride?.driver_id) { setDriver(null); setDriverProfile(null); return; }
    let mounted = true;
    (async () => {
      const [{ data: loc }, { data: d }, { data: p }] = await Promise.all([
        supabase.from("driver_locations").select("*").eq("driver_id", ride.driver_id!).maybeSingle(),
        supabase.from("drivers").select("*").eq("id", ride.driver_id!).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", ride.driver_id!).maybeSingle(),
      ]);
      if (!mounted) return;
      setDriverLoc(loc); setDriver(d); setDriverProfile(p);
    })();
    const ch = supabase
      .channel(`driver-loc-${ride.driver_id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${ride.driver_id}` },
        (p) => setDriverLoc(p.new as Loc))
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
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
