import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type Offer = Database["public"]["Tables"]["ride_offers"]["Row"] & {
  rides?: Pick<Database["public"]["Tables"]["rides"]["Row"], "pickup_address" | "dropoff_address" | "pickup_lat" | "pickup_lng">;
};

export const Route = createFileRoute("/_authenticated/driver")({
  component: DriverHome,
});

function DriverHome() {
  const { user, isDriver } = useAuth();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    if (!user || !isDriver) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      const { data } = await supabase.from("drivers").select("*").eq("id", user.id).maybeSingle();
      if (mounted) { setDriver(data); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [user, isDriver]);

  // pending offers subscription
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

  // location heartbeat while online
  useEffect(() => {
    if (!user || driver?.status !== "online") return;
    if (!navigator.geolocation) { toast.error("Geolocation not available"); return; }
    let cancelled = false;
    const push = (pos: GeolocationPosition) => {
      if (cancelled) return;
      void supabase.from("driver_locations").upsert({
        driver_id: user.id,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading ?? null,
        speed: pos.coords.speed ?? null,
        accuracy: pos.coords.accuracy ?? null,
        updated_at: new Date().toISOString(),
      });
      void supabase.from("drivers").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    };
    const watchId = navigator.geolocation.watchPosition(push, (e) => console.warn("geo error", e), { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
    return () => { cancelled = true; navigator.geolocation.clearWatch(watchId); };
  }, [user, driver?.status]);

  async function toggleOnline(next: boolean) {
    if (!user || !driver) return;
    if (driver.verification !== "approved") {
      toast.error("Account not approved yet (admin-only in MVP)");
      return;
    }
    const { data, error } = await supabase.from("drivers")
      .update({ status: next ? "online" : "offline", last_seen_at: new Date().toISOString() })
      .eq("id", user.id).select().single();
    if (error) toast.error(error.message);
    else setDriver(data);
  }

  async function accept(offerId: string) {
    const { error } = await supabase.rpc("accept_ride_offer", { _offer_id: offerId });
    if (error) toast.error(error.message);
    else toast.success("Ride accepted");
  }
  async function reject(offerId: string) {
    const { error } = await supabase.rpc("reject_ride_offer", { _offer_id: offerId });
    if (error) toast.error(error.message);
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
        <Switch checked={driver.status !== "offline"} onCheckedChange={toggleOnline} />
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Incoming offers</h2>
        {offers.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No offers right now. Stay online.</Card>
        ) : (
          <div className="space-y-2">
            {offers.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium">{o.rides?.pickup_address || `Pickup ${o.rides?.pickup_lat?.toFixed(4)}, ${o.rides?.pickup_lng?.toFixed(4)}`}</div>
                    <div className="text-muted-foreground">→ {o.rides?.dropoff_address || "Drop-off"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{o.distance_km ? `${Number(o.distance_km).toFixed(2)} km away` : ""} · expires {new Date(o.expires_at).toLocaleTimeString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => reject(o.id)}>Skip</Button>
                    <Button size="sm" onClick={() => accept(o.id)}>Accept</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
