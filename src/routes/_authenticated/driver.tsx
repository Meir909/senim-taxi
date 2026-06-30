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

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type Ride = Database["public"]["Tables"]["rides"]["Row"];
type Offer = Database["public"]["Tables"]["ride_offers"]["Row"] & {
  rides?: Pick<Ride, "pickup_address" | "dropoff_address" | "pickup_lat" | "pickup_lng">;
};

export const Route = createFileRoute("/_authenticated/driver")({
  component: DriverHome,
});

const ACTIVE_STATUSES: Ride["status"][] = ["accepted", "driver_arriving", "driver_arrived", "in_progress"];

function DriverHome() {
  const { user, isDriver } = useAuth();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);

  // load driver
  useEffect(() => {
    if (!user || !isDriver) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      const { data } = await supabase.from("drivers").select("*").eq("id", user.id).maybeSingle();
      if (mounted) { setDriver(data); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [user, isDriver]);

  // pending offers
  useEffect(() => {
    if (!user || !isDriver) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("ride_offers")
        .select("*, rides(pickup_address, dropoff_address, pickup_lat, pickup_lng)")
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

  // active ride
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

  // location heartbeat while online or on ride
  useEffect(() => {
    if (!user) return;
    const active = driver?.status === "online" || driver?.status === "on_ride";
    if (!active) return;
    if (!navigator.geolocation) { toast.error("Geolocation not available"); return; }
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
    if (driver.verification !== "approved") { toast.error("Account not approved yet"); return; }
    const { data, error } = await supabase.from("drivers")
      .update({ status: next ? "online" : "offline", last_seen_at: new Date().toISOString() })
      .eq("id", user.id).select().single();
    if (error) toast.error(error.message); else setDriver(data);
  }

  async function accept(offerId: string) {
    const { error } = await supabase.rpc("accept_ride_offer", { _offer_id: offerId });
    if (error) toast.error(error.message); else toast.success("Ride accepted");
  }
  async function reject(offerId: string) {
    const { error } = await supabase.rpc("reject_ride_offer", { _offer_id: offerId });
    if (error) toast.error(error.message);
  }

  async function setRideStatus(status: Ride["status"]) {
    if (!activeRide) return;
    const patch: Partial<Ride> = { status };
    if (status === "driver_arrived") patch.arrived_at = new Date().toISOString();
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
    return (
      <Card className="p-6 text-center">
        <h2 className="text-lg font-semibold">Become a driver</h2>
        <p className="mt-1 text-sm text-muted-foreground">Add your vehicle to start accepting rides.</p>
        <Button asChild className="mt-4"><Link to="/become-driver">Get started</Link></Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-muted-foreground">Status</div>
          <div className="text-lg font-semibold">{driver.status === "online" ? "Online" : driver.status === "on_ride" ? "On a ride" : "Offline"}</div>
          <div className="mt-1 text-xs text-muted-foreground">Verification: <Badge variant={driver.verification === "approved" ? "default" : "secondary"}>{driver.verification}</Badge></div>
        </div>
        <Switch checked={driver.status !== "offline"} onCheckedChange={toggleOnline} disabled={!!activeRide} />
      </Card>

      <DriverMap activeRide={activeRide} pos={pos} />

      {activeRide ? (
        <ActiveRideCard
          ride={activeRide}
          onArrived={() => void setRideStatus("driver_arrived")}
          onStart={() => void setRideStatus("in_progress")}
          onComplete={() => setCompleteOpen(true)}
          onCancel={() => void cancelRide()}
        />
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Incoming offers</h2>
          {offers.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">No offers right now. Stay online.</Card>
          ) : (
            <div className="space-y-2">
              {offers.map((o) => (
                <Card key={o.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <div className="truncate font-medium">{o.rides?.pickup_address || `Pickup ${o.rides?.pickup_lat?.toFixed(4)}, ${o.rides?.pickup_lng?.toFixed(4)}`}</div>
                      <div className="truncate text-muted-foreground">→ {o.rides?.dropoff_address || "Drop-off"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{o.distance_km ? `${Number(o.distance_km).toFixed(2)} km away` : ""} · expires {new Date(o.expires_at).toLocaleTimeString()}</div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => reject(o.id)}>Skip</Button>
                      <Button size="sm" onClick={() => accept(o.id)}>Accept</Button>
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
        startedAt={activeRide?.started_at ?? null}
        onDone={() => setCompleteOpen(false)}
      />
    </div>
  );
}

function DriverMap({ activeRide, pos }: { activeRide: Ride | null; pos: { lat: number; lng: number } | null }) {
  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (pos) m.push({ id: "me", lat: pos.lat, lng: pos.lng, color: "#f59e0b", label: "🚗" });
    if (activeRide) {
      m.push({ id: "pickup", lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, color: "#16a34a", label: "P" });
      m.push({ id: "dropoff", lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng, color: "#2563eb", label: "D" });
    }
    return m;
  }, [activeRide, pos]);

  return (
    <div className="overflow-hidden rounded-xl border">
      <MapGL className="h-72 w-full" markers={markers} center={pos ?? undefined} zoom={13} />
    </div>
  );
}

const STATUS_NEXT_LABEL: Partial<Record<Ride["status"], string>> = {
  accepted: "I've arrived",
  driver_arriving: "I've arrived",
  driver_arrived: "Start trip",
  in_progress: "Complete",
};

function ActiveRideCard({
  ride, onArrived, onStart, onComplete, onCancel,
}: {
  ride: Ride;
  onArrived: () => void; onStart: () => void; onComplete: () => void; onCancel: () => void;
}) {
  const nextLabel = STATUS_NEXT_LABEL[ride.status];
  const handleNext =
    ride.status === "in_progress" ? onComplete :
    ride.status === "driver_arrived" ? onStart : onArrived;

  const openInMaps = () => {
    const target = ride.status === "in_progress"
      ? { lat: ride.dropoff_lat, lng: ride.dropoff_lng }
      : { lat: ride.pickup_lat, lng: ride.pickup_lng };
    window.open(`https://2gis.com/directions/points/|${target.lng},${target.lat}|`, "_blank", "noopener");
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <Badge>{ride.status.replace(/_/g, " ")}</Badge>
        <span className="text-xs text-muted-foreground">#{ride.id.slice(0, 8)}</span>
      </div>
      <div className="space-y-1 text-sm">
        <div><span className="text-muted-foreground">Pickup:</span> {ride.pickup_address || `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`}</div>
        <div><span className="text-muted-foreground">Drop-off:</span> {ride.dropoff_address || `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {nextLabel && <Button onClick={handleNext}>{nextLabel}</Button>}
        <Button variant="outline" onClick={openInMaps}><Navigation className="mr-1.5 h-4 w-4" />Navigate</Button>
        {ride.status !== "in_progress" && (
          <Button variant="ghost" onClick={onCancel}><X className="mr-1.5 h-4 w-4" />Cancel</Button>
        )}
      </div>
    </Card>
  );
}

function CompleteDialog({
  open, onOpenChange, ride, startedAt, onDone,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  ride: Ride | null; startedAt: string | null; onDone: () => void;
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

  async function submit() {
    const fareNum = Number(fare);
    const distNum = Number(distance);
    if (!ride) return;
    if (!fareNum || fareNum <= 0) { toast.error("Enter a valid fare"); return; }
    if (!distNum || distNum <= 0) { toast.error("Enter a valid distance"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("complete_ride", {
      _ride_id: ride.id, _fare: fareNum, _distance: distNum, _duration: durationMin,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Earnings added (${(fareNum * 0.8).toFixed(2)})`);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Complete ride</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="fare">Fare (USD)</Label>
            <Input id="fare" inputMode="decimal" value={fare} onChange={(e) => setFare(e.target.value)} placeholder="e.g. 12.50" />
          </div>
          <div>
            <Label htmlFor="dist">Distance (km)</Label>
            <Input id="dist" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="e.g. 4.3" />
          </div>
          <p className="text-xs text-muted-foreground">Duration: {durationMin} min · Platform fee: 20%</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
