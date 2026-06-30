import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

type Ride = Database["public"]["Tables"]["rides"]["Row"];
type Loc = Database["public"]["Tables"]["driver_locations"]["Row"];

export const Route = createFileRoute("/_authenticated/passenger/ride/$rideId")({
  component: RideView,
});

const STATUS_LABEL: Record<Ride["status"], string> = {
  requested: "Requesting…",
  searching: "Looking for a driver…",
  accepted: "Driver assigned",
  driver_arriving: "Driver on the way",
  driver_arrived: "Driver has arrived",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_drivers: "No drivers nearby",
};

function RideView() {
  const { rideId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverLoc, setDriverLoc] = useState<Loc | null>(null);
  const [loading, setLoading] = useState(true);

  // load + subscribe to ride
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

  // subscribe to driver location once assigned
  useEffect(() => {
    if (!ride?.driver_id) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase.from("driver_locations").select("*").eq("driver_id", ride.driver_id!).maybeSingle();
      if (mounted) setDriverLoc(data);
    })();
    const ch = supabase
      .channel(`driver-loc-${ride.driver_id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${ride.driver_id}` },
        (p) => setDriverLoc(p.new as Loc))
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [ride?.driver_id]);

  // redirect when finished
  useEffect(() => {
    if (ride && (ride.status === "completed" || ride.status === "cancelled" || ride.status === "no_drivers")) {
      const t = setTimeout(() => void navigate({ to: "/passenger", replace: true }), 4000);
      return () => clearTimeout(t);
    }
  }, [ride?.status, navigate, ride]);

  async function cancel() {
    if (!ride || !user) return;
    const { error } = await supabase
      .from("rides")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: "passenger_cancelled" })
      .eq("id", ride.id)
      .eq("passenger_id", user.id);
    if (error) toast.error(error.message);
    else toast.info("Ride cancelled");
  }

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!ride) return <div className="text-center text-muted-foreground">Ride not found.</div>;

  const canCancel = ["requested", "searching", "accepted", "driver_arriving"].includes(ride.status);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <Badge variant={ride.status === "completed" ? "default" : "secondary"}>{STATUS_LABEL[ride.status]}</Badge>
          <span className="text-xs text-muted-foreground">#{ride.id.slice(0, 8)}</span>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <Row label="Pickup" value={ride.pickup_address || `${ride.pickup_lat.toFixed(5)}, ${ride.pickup_lng.toFixed(5)}`} />
          <Row label="Drop-off" value={ride.dropoff_address || `${ride.dropoff_lat.toFixed(5)}, ${ride.dropoff_lng.toFixed(5)}`} />
          {ride.fare_amount != null && <Row label="Fare" value={`${ride.fare_amount} ${"USD"}`} />}
        </div>
      </Card>

      {ride.driver_id && (
        <Card className="p-5">
          <div className="text-sm font-medium">Driver location</div>
          {driverLoc ? (
            <div className="mt-2 text-sm text-muted-foreground">
              {driverLoc.lat.toFixed(5)}, {driverLoc.lng.toFixed(5)} — updated {new Date(driverLoc.updated_at).toLocaleTimeString()}
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">Waiting for driver location…</div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Live map (2GIS) comes in next phase.</p>
        </Card>
      )}

      {canCancel && (
        <Button variant="outline" className="w-full" onClick={cancel}>
          <X className="mr-2 h-4 w-4" /> Cancel ride
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
