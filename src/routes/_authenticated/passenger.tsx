import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { AddressPicker, type PickedPoint } from "@/components/AddressPicker";

type Ride = Database["public"]["Tables"]["rides"]["Row"];

export const Route = createFileRoute("/_authenticated/passenger")({
  component: PassengerHome,
});

function PassengerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickup, setPickup] = useState<PickedPoint | null>(null);
  const [dropoff, setDropoff] = useState<PickedPoint | null>(null);

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
      if (mounted) {
        setActiveRide(data);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (activeRide) {
      void navigate({ to: "/passenger/ride/$rideId", params: { rideId: activeRide.id }, replace: true });
    }
  }, [activeRide, navigate]);

  async function handleRequest() {
    if (!user || !pickup || !dropoff) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("rides")
        .insert({
          passenger_id: user.id,
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          pickup_address: pickup.address,
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
          dropoff_address: dropoff.address,
          status: "searching",
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Ищем водителя…");
      void navigate({ to: "/passenger/ride/$rideId", params: { rideId: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать заказ");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (activeRide) return null;

  const ready = pickup && dropoff && !submitting;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Куда едем?</h1>
        <p className="text-sm text-muted-foreground">Найдите адрес или коснитесь карты, чтобы указать точки.</p>
      </div>
      <Card className="space-y-5 p-4 sm:p-5">
        <AddressPicker label="Откуда" color="#16a34a" onChange={setPickup} initialPoint={pickup} showMyLocation />
        <AddressPicker label="Куда" color="#2563eb" onChange={setDropoff} initialPoint={dropoff} />
        <Button onClick={handleRequest} disabled={!ready} size="lg" className="w-full">
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Заказать поездку
        </Button>
      </Card>
    </div>
  );
}
