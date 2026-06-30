import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type Ride = Database["public"]["Tables"]["rides"]["Row"];

export const Route = createFileRoute("/_authenticated/passenger")({
  component: PassengerHome,
});

const coordSchema = z.coerce.number().refine((n) => Number.isFinite(n), "Required");

function PassengerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq("passenger_id", user.id)
        .in("status", ["requested", "searching", "accepted", "driver_arriving", "driver_arrived", "in_progress"])
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) { setActiveRide(data); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [user]);

  async function handleRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    try {
      const pickup_lat = coordSchema.parse(fd.get("pickup_lat"));
      const pickup_lng = coordSchema.parse(fd.get("pickup_lng"));
      const dropoff_lat = coordSchema.parse(fd.get("dropoff_lat"));
      const dropoff_lng = coordSchema.parse(fd.get("dropoff_lng"));
      const pickup_address = String(fd.get("pickup_address") ?? "").trim().slice(0, 250);
      const dropoff_address = String(fd.get("dropoff_address") ?? "").trim().slice(0, 250);
      setSubmitting(true);
      const { data, error } = await supabase
        .from("rides")
        .insert({
          passenger_id: user.id,
          pickup_lat, pickup_lng, pickup_address,
          dropoff_lat, dropoff_lng, dropoff_address,
          status: "searching",
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Looking for a driver…");
      setActiveRide(data);
      void navigate({ to: "/passenger/ride/$rideId", params: { rideId: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create ride");
    } finally { setSubmitting(false); }
  }

  function useMyLocation(latName: string, lngName: string) {
    if (!navigator.geolocation) return toast.error("Geolocation not available");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const form = document.querySelector("form");
        if (!form) return;
        (form.elements.namedItem(latName) as HTMLInputElement).value = String(pos.coords.latitude);
        (form.elements.namedItem(lngName) as HTMLInputElement).value = String(pos.coords.longitude);
      },
      () => toast.error("Could not get location"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (activeRide) {
    void navigate({ to: "/passenger/ride/$rideId", params: { rideId: activeRide.id }, replace: true });
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Where to?</h1>
        <p className="text-sm text-muted-foreground">Set pickup and drop-off to request a ride.</p>
      </div>
      <Card className="p-5">
        <form onSubmit={handleRequest} className="space-y-5">
          <CoordRow title="Pickup" icon={<MapPin className="h-4 w-4 text-success" />} addressName="pickup_address" latName="pickup_lat" lngName="pickup_lng" onLocate={() => useMyLocation("pickup_lat", "pickup_lng")} />
          <CoordRow title="Drop-off" icon={<Navigation className="h-4 w-4 text-primary" />} addressName="dropoff_address" latName="dropoff_lat" lngName="dropoff_lng" />
          <Button type="submit" className="w-full" disabled={submitting} size="lg">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Request ride
          </Button>
          <p className="text-xs text-muted-foreground">Map picker coming in next phase. For now enter coordinates or use "My location".</p>
        </form>
      </Card>
    </div>
  );
}

function CoordRow({ title, icon, addressName, latName, lngName, onLocate }: {
  title: string; icon: React.ReactNode; addressName: string; latName: string; lngName: string; onLocate?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
      <Input name={addressName} placeholder="Address (optional)" maxLength={250} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label className="text-xs">Latitude</Label><Input name={latName} type="number" step="any" required /></div>
        <div className="space-y-1"><Label className="text-xs">Longitude</Label><Input name={lngName} type="number" step="any" required /></div>
      </div>
      {onLocate && <Button type="button" variant="outline" size="sm" onClick={onLocate}>Use my location</Button>}
    </div>
  );
}
