import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, X, ArrowLeft } from "lucide-react";
import { MapGL, type MapMarker } from "@/components/MapGL";
import { StarRating } from "@/components/StarRating";
import { UserBadgeCard } from "@/components/UserBadgeCard";

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

  const [rating, setRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    if (ride && (ride.status === "cancelled" || ride.status === "no_drivers")) {
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
    if (!ride || !user) return;
    const { error } = await supabase
      .from("rides")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: "passenger_cancelled" })
      .eq("id", ride.id)
      .eq("passenger_id", user.id);
    if (error) toast.error(error.message);
    else toast.info("Поездка отменена");
  }

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!ride) return <div className="text-center text-muted-foreground">Поездка не найдена.</div>;

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

      {canCancel && (
        <Button variant="outline" className="w-full" onClick={cancel}>
          <X className="mr-2 h-4 w-4" /> Отменить поездку
        </Button>
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
