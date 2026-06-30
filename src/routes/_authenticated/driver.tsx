import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Navigation, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { MapGL, type MapMarker } from "@/components/MapGL";
import { UserBadgeCard } from "@/components/UserBadgeCard";
import { StarRating } from "@/components/StarRating";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type Ride = Database["public"]["Tables"]["rides"]["Row"];
type Offer = Database["public"]["Tables"]["ride_offers"]["Row"] & {
  rides?: Pick<Ride, "pickup_address" | "dropoff_address" | "pickup_lat" | "pickup_lng" | "passenger_id">;
};
type PassengerInfo = { id: string; name: string; rating: number | null };

export const Route = createFileRoute("/_authenticated/driver")({
  component: DriverHome,
});

const ACTIVE_STATUSES: Ride["status"][] = ["accepted", "driver_arriving", "driver_arrived", "in_progress"];

const DRIVER_STATUS: Record<string, string> = {
  online: "На линии",
  offline: "Не на линии",
  on_ride: "В поездке",
};
const VERIFICATION: Record<string, string> = {
  pending: "Ожидает",
  approved: "Подтверждён",
  rejected: "Отклонён",
};
const RIDE_STATUS_RU: Partial<Record<Ride["status"], string>> = {
  accepted: "Принято",
  driver_arriving: "В пути к клиенту",
  driver_arrived: "На месте",
  in_progress: "В поездке",
};

function DriverHome() {
  const { user, isDriver, hasDriverApplication, driverVerification } = useAuth();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [rideToRate, setRideToRate] = useState<Ride | null>(null);

  useEffect(() => {
    if (!user || !isDriver) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      const { data } = await supabase.from("drivers").select("*").eq("id", user.id).maybeSingle();
      if (mounted) { setDriver(data); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [user, isDriver]);

  useEffect(() => {
    if (!user || !isDriver) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("ride_offers")
        .select("*, rides(pickup_address, dropoff_address, pickup_lat, pickup_lng, passenger_id)")
        .eq("driver_id", user.id).eq("status", "pending")
        .order("created_at", { ascending: false });
      if (mounted) setOffers((data ?? []) as Offer[]);
    };
    void load();
    const ch = supabase
      .channel(`offers-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_offers", filter: `driver_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user, isDriver]);

  useEffect(() => {
    if (!user || !isDriver) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .in("status", ACTIVE_STATUSES)
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) setActiveRide(data);
    };
    void load();
    const ch = supabase
      .channel(`driver-rides-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `driver_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user, isDriver]);

  useEffect(() => {
    if (!user) return;
    const active = driver?.status === "online" || driver?.status === "on_ride";
    if (!active) return;
    if (!navigator.geolocation) { toast.error("Геолокация недоступна"); return; }
    let cancelled = false;
    const push = (p: GeolocationPosition) => {
      if (cancelled) return;
      const next = { lat: p.coords.latitude, lng: p.coords.longitude };
      setPos(next);
      void supabase.from("driver_locations").upsert({
        driver_id: user.id, lat: next.lat, lng: next.lng,
        heading: p.coords.heading ?? null, speed: p.coords.speed ?? null,
        accuracy: p.coords.accuracy ?? null, updated_at: new Date().toISOString(),
      });
      void supabase.from("drivers").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    };
    const watchId = navigator.geolocation.watchPosition(push, (e) => console.warn("geo error", e), { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
    return () => { cancelled = true; navigator.geolocation.clearWatch(watchId); };
  }, [user, driver?.status]);

  async function toggleOnline(next: boolean) {
    if (!user || !driver) return;
    if (driver.verification !== "approved") { toast.error("Аккаунт ещё не подтверждён"); return; }
    const { data, error } = await supabase.from("drivers")
      .update({ status: next ? "online" : "offline", last_seen_at: new Date().toISOString() })
      .eq("id", user.id).select().single();
    if (error) toast.error(error.message); else setDriver(data);
  }

  async function accept(offerId: string) {
    const { error } = await supabase.rpc("accept_ride_offer", { _offer_id: offerId });
    if (error) toast.error(error.message); else toast.success("Заказ принят");
  }
  async function reject(offerId: string) {
    const { error } = await supabase.rpc("reject_ride_offer", { _offer_id: offerId });
    if (error) toast.error(error.message);
  }

  async function setRideStatus(status: Ride["status"]) {
    if (!activeRide) return;
    const patch: Partial<Ride> = { status };
    if (status === "in_progress") patch.started_at = new Date().toISOString();
    const { error } = await supabase.from("rides").update(patch).eq("id", activeRide.id);
    if (error) toast.error(error.message);
  }

  async function cancelRide() {
    if (!activeRide) return;
    const { error } = await supabase.from("rides")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: "driver_cancelled" })
      .eq("id", activeRide.id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("drivers").update({ status: "online" }).eq("id", user!.id);
    }
  }

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!isDriver || !driver) {
    if (hasDriverApplication && driverVerification === "pending") {
      return (
        <Card className="p-6 text-center">
          <h2 className="text-lg font-semibold">Заявка на проверке</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Раздел водителя откроется после одобрения администратором.
          </p>
        </Card>
      );
    }
    if (hasDriverApplication && driverVerification === "rejected") {
      return (
        <Card className="p-6 text-center">
          <h2 className="text-lg font-semibold">Заявка отклонена</h2>
          <p className="mt-1 text-sm text-muted-foreground">Обновите данные и подайте повторно.</p>
          <Button asChild className="mt-4"><Link to="/become-driver">Подать заново</Link></Button>
        </Card>
      );
    }
    return (
      <Card className="p-6 text-center">
        <h2 className="text-lg font-semibold">Стать водителем</h2>
        <p className="mt-1 text-sm text-muted-foreground">Добавьте автомобиль, чтобы принимать заказы.</p>
        <Button asChild className="mt-4"><Link to="/become-driver">Начать</Link></Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">Статус</div>
          <div className="truncate text-lg font-semibold">{DRIVER_STATUS[driver.status] ?? driver.status}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            Подтверждение: <Badge variant={driver.verification === "approved" ? "default" : "secondary"}>{VERIFICATION[driver.verification] ?? driver.verification}</Badge>
          </div>
        </div>
        <Switch checked={driver.status !== "offline"} onCheckedChange={toggleOnline} disabled={!!activeRide} />
      </Card>

      <DriverMap activeRide={activeRide} pos={pos} />

      {activeRide ? (
        <ActiveRideCard
          ride={activeRide}
          pos={pos}
          onArrived={() => void setRideStatus("driver_arrived")}
          onStart={() => void setRideStatus("in_progress")}
          onComplete={() => setCompleteOpen(true)}
          onCancel={() => void cancelRide()}
        />
      ) : rideToRate ? (
        <RatePassengerCard ride={rideToRate} onDone={() => setRideToRate(null)} />
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Входящие заказы</h2>
          {offers.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Заказов пока нет. Оставайтесь на линии.</Card>
          ) : (
            <div className="space-y-2">
              {offers.map((o) => (
                <Card key={o.id} className="p-4 space-y-3">
                  {o.rides?.passenger_id && (
                    <OfferPassengerBadge passengerId={o.rides.passenger_id} />
                  )}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <div className="truncate font-medium">{o.rides?.pickup_address || `Точка A ${o.rides?.pickup_lat?.toFixed(4)}, ${o.rides?.pickup_lng?.toFixed(4)}`}</div>
                      <div className="truncate text-muted-foreground">→ {o.rides?.dropoff_address || "Точка B"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {o.distance_km ? `${Number(o.distance_km).toFixed(2)} км` : ""} · истекает {new Date(o.expires_at).toLocaleTimeString("ru-RU")}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => reject(o.id)}>Пропустить</Button>
                      <Button size="sm" className="flex-1 sm:flex-none" onClick={() => accept(o.id)}>Принять</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <CompleteDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        ride={activeRide}
        pos={pos}
        startedAt={activeRide?.started_at ?? null}
        onDone={(completed) => {
          setCompleteOpen(false);
          if (completed) setRideToRate(completed);
        }}
      />
    </div>
  );
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function OfferPassengerBadge({ passengerId }: { passengerId: string }) {
  const [info, setInfo] = useState<{ name: string; rating: number | null } | null>(null);
  useEffect(() => {
    let mounted = true;
    void supabase.from("profiles").select("first_name, last_name, full_name, rating").eq("id", passengerId).maybeSingle()
      .then(({ data }) => {
        if (!mounted || !data) return;
        const name = [data.last_name, data.first_name].filter(Boolean).join(" ") || data.full_name || "Пассажир";
        setInfo({ name, rating: data.rating != null ? Number(data.rating) : null });
      });
    return () => { mounted = false; };
  }, [passengerId]);
  return <UserBadgeCard userId={passengerId} name={info?.name} rating={info?.rating ?? null} size="sm" />;
}

function RatePassengerCard({ ride, onDone }: { ride: Ride; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (rating < 1) return;
    setBusy(true);
    const { error } = await supabase.rpc("rate_ride", { _ride_id: ride.id, _rating: rating });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Спасибо за оценку!");
    onDone();
  }
  return (
    <Card className="p-5">
      <h3 className="text-center font-semibold">Оцените пассажира</h3>
      <p className="mt-1 text-center text-sm text-muted-foreground">Это поможет другим водителям.</p>
      <div className="mt-4 flex justify-center">
        <StarRating value={rating} onChange={setRating} size={40} />
      </div>
      <Button className="mt-4 w-full" size="lg" disabled={rating < 1 || busy} onClick={submit}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Отправить
      </Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={onDone}>Пропустить</Button>
    </Card>
  );
}

function DriverMap({ activeRide, pos }: { activeRide: Ride | null; pos: { lat: number; lng: number } | null }) {
  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (pos) m.push({ id: "me", lat: pos.lat, lng: pos.lng, color: "#f59e0b", label: "🚗" });
    if (activeRide) {
      m.push({ id: "pickup", lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, color: "#16a34a", label: "A" });
      m.push({ id: "dropoff", lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng, color: "#2563eb", label: "B" });
    }
    return m;
  }, [activeRide, pos]);

  return (
    <div className="overflow-hidden rounded-xl border">
      <MapGL className="h-64 w-full sm:h-72" markers={markers} center={pos ?? undefined} zoom={13} />
    </div>
  );
}

const STATUS_NEXT_LABEL: Partial<Record<Ride["status"], string>> = {
  accepted: "Я на месте",
  driver_arriving: "Я на месте",
  driver_arrived: "Начать поездку",
  in_progress: "Завершить",
};

function ActiveRideCard({
  ride, pos, onArrived, onStart, onComplete, onCancel,
}: {
  ride: Ride;
  pos: { lat: number; lng: number } | null;
  onArrived: () => void; onStart: () => void; onComplete: () => void; onCancel: () => void;
}) {
  const nextLabel = STATUS_NEXT_LABEL[ride.status];
  const handleNext =
    ride.status === "in_progress" ? onComplete :
    ride.status === "driver_arrived" ? onStart : onArrived;

  const distToDropoff = pos ? distanceMeters(pos, { lat: ride.dropoff_lat, lng: ride.dropoff_lng }) : null;
  const tooFar = ride.status === "in_progress" && (distToDropoff == null || distToDropoff > 200);

  const openInMaps = () => {
    const target = ride.status === "in_progress"
      ? { lat: ride.dropoff_lat, lng: ride.dropoff_lng }
      : { lat: ride.pickup_lat, lng: ride.pickup_lng };
    window.open(`https://2gis.com/directions/points/|${target.lng},${target.lat}|`, "_blank", "noopener");
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <Badge>{RIDE_STATUS_RU[ride.status] ?? ride.status}</Badge>
        <span className="shrink-0 text-xs text-muted-foreground">#{ride.id.slice(0, 8)}</span>
      </div>
      <div className="space-y-1 text-sm">
        <div><span className="text-muted-foreground">Откуда:</span> {ride.pickup_address || `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`}</div>
        <div><span className="text-muted-foreground">Куда:</span> {ride.dropoff_address || `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`}</div>
        {ride.status === "in_progress" && distToDropoff != null && (
          <div className="text-xs text-muted-foreground">
            До точки назначения: {distToDropoff < 1000 ? `${Math.round(distToDropoff)} м` : `${(distToDropoff / 1000).toFixed(2)} км`}
            {tooFar && " — кнопка завершения активируется в радиусе 200 м"}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {nextLabel && (
          <Button onClick={handleNext} disabled={ride.status === "in_progress" && tooFar}>
            {nextLabel}
          </Button>
        )}
        <Button variant="outline" onClick={openInMaps}><Navigation className="mr-1.5 h-4 w-4" />Маршрут</Button>
        {ride.status !== "in_progress" && (
          <Button variant="ghost" onClick={onCancel}><X className="mr-1.5 h-4 w-4" />Отменить</Button>
        )}
      </div>
    </Card>
  );
}

function CompleteDialog({
  open, onOpenChange, ride, pos, startedAt, onDone,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  ride: Ride | null; pos: { lat: number; lng: number } | null;
  startedAt: string | null; onDone: (completed: Ride | null) => void;
}) {
  const [fare, setFare] = useState("");
  const [distance, setDistance] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setFare(""); setDistance(""); }
  }, [open]);

  if (!ride) return null;

  const durationMin = startedAt
    ? Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000))
    : 1;

  const distToDropoff = pos ? distanceMeters(pos, { lat: ride.dropoff_lat, lng: ride.dropoff_lng }) : null;
  const tooFar = distToDropoff == null || distToDropoff > 200;

  async function submit() {
    const fareNum = Number(fare);
    const distNum = Number(distance);
    if (!ride) return;
    if (!pos) { toast.error("Не удалось определить местоположение"); return; }
    if (tooFar) {
      toast.error(`Подъезжайте к точке назначения${distToDropoff != null ? ` (${Math.round(distToDropoff)} м)` : ""}`);
      return;
    }
    if (!fareNum || fareNum <= 0) { toast.error("Укажите стоимость"); return; }
    if (!distNum || distNum <= 0) { toast.error("Укажите расстояние"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("complete_ride", {
      _ride_id: ride.id, _fare: fareNum, _distance: distNum, _duration: durationMin,
      _lat: pos.lat, _lng: pos.lng,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Зачислено: ${(fareNum * 0.8).toFixed(2)}`);
    onDone((data as Ride | null) ?? ride);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Завершить поездку</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {tooFar && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              Завершить можно только в радиусе 200 м от точки назначения
              {distToDropoff != null && ` (сейчас ${Math.round(distToDropoff)} м)`}.
            </div>
          )}
          <div>
            <Label htmlFor="fare">Стоимость (₸)</Label>
            <Input id="fare" inputMode="decimal" value={fare} onChange={(e) => setFare(e.target.value)} placeholder="напр. 1500" />
          </div>
          <div>
            <Label htmlFor="dist">Расстояние (км)</Label>
            <Input id="dist" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="напр. 4.3" />
          </div>
          <p className="text-xs text-muted-foreground">Длительность: {durationMin} мин · Комиссия платформы: 20%</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Отмена</Button>
          <Button onClick={submit} disabled={busy || tooFar}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Завершить"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
