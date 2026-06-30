import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MapPin, ChevronRight, Star, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Database } from "@/integrations/supabase/types";

type Ride = Database["public"]["Tables"]["rides"]["Row"];

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

const STATUS_LABEL: Record<Ride["status"], string> = {
  requested: "Создаётся",
  searching: "Поиск",
  accepted: "Принята",
  driver_arriving: "Едет",
  driver_arrived: "Прибыл",
  in_progress: "В пути",
  completed: "Завершено",
  cancelled: "Отменено",
  no_drivers: "Нет водителей",
};

function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRides([]);
      setLoading(false);
      setError(null);
      return;
    }
    const userId = user.id;

    let mounted = true;

    async function loadRides() {
      setError(null);
      if (mounted) setLoading(true);

      const { data, error: queryError } = await supabase
        .from("rides")
        .select("*")
        .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
        .order("requested_at", { ascending: false })
        .limit(50);

      if (!mounted) return;

      if (queryError) {
        setError(queryError.message);
        setRides([]);
        setLoading(false);
        toast.error("Не удалось загрузить историю поездок");
        return;
      }

      setRides(data ?? []);
      setLoading(false);
    }

    void loadRides();

    const passengerChannel = supabase
      .channel(`history-passenger-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `passenger_id=eq.${userId}` },
        () => void loadRides(),
      )
      .subscribe();

    const driverChannel = supabase
      .channel(`history-driver-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `driver_id=eq.${userId}` },
        () => void loadRides(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(passengerChannel);
      supabase.removeChannel(driverChannel);
    };
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">История поездок</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Здесь отображаются последние заказы как пассажира и как водителя.
        </p>
      </div>

      {error ? (
        <Card className="p-6 text-center">
          <ReceiptText className="mx-auto h-10 w-10 text-destructive/60" />
          <p className="mt-3 font-medium">Не удалось загрузить историю</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </Card>
      ) : rides.length === 0 ? (
        <Card className="p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 font-medium">Пока нет поездок</p>
          <p className="mt-1 text-sm text-muted-foreground">Ваши заказы появятся здесь.</p>
        </Card>
      ) : (
        rides.map((ride) => {
          const rating = ride.driver_rating ?? ride.passenger_rating;
          const roleLabel = ride.driver_id === user?.id ? "Как водитель" : "Как пассажир";

          return (
            <Link
              key={ride.id}
              to="/passenger/ride/$rideId"
              params={{ rideId: ride.id }}
              className="block"
            >
              <Card className="p-4 transition-colors hover:bg-accent/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          ride.status === "completed"
                            ? "default"
                            : ride.status === "cancelled" || ride.status === "no_drivers"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {STATUS_LABEL[ride.status]}
                      </Badge>
                      <Badge variant="outline">{roleLabel}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ride.requested_at).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="space-y-0.5 text-sm">
                      <div className="flex items-start gap-1.5">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                        <span className="truncate">{ride.pickup_address ?? "—"}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="truncate">{ride.dropoff_address ?? "—"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {ride.fare_amount != null && (
                        <span className="font-semibold text-foreground">
                          {Number(ride.fare_amount)} ₸
                        </span>
                      )}
                      {ride.distance_km != null && (
                        <span>{Number(ride.distance_km).toFixed(1)} км</span>
                      )}
                      {rating != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          {Number(rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </Card>
            </Link>
          );
        })
      )}
    </div>
  );
}
