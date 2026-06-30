import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, ChevronRight, Star } from "lucide-react";
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
  const { user, isDriver } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const col = isDriver ? "driver_id" : "passenger_id";
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq(col, user.id)
        .order("requested_at", { ascending: false })
        .limit(50);
      if (mounted) {
        setRides(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, isDriver]);

  if (loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MapPin className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 font-medium">Пока нет поездок</p>
        <p className="mt-1 text-sm text-muted-foreground">Ваши заказы появятся здесь.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">История поездок</h1>
      {rides.map((r) => {
        const rating = isDriver ? r.passenger_rating : r.driver_rating;
        return (
          <Link
            key={r.id}
            to="/passenger/ride/$rideId"
            params={{ rideId: r.id }}
            className="block"
          >
            <Card className="p-4 transition-colors hover:bg-accent/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "completed" ? "default" : r.status === "cancelled" || r.status === "no_drivers" ? "destructive" : "secondary"}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.requested_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-sm">
                    <div className="flex items-start gap-1.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                      <span className="truncate">{r.pickup_address ?? "—"}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="truncate">{r.dropoff_address ?? "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {r.fare_amount != null && <span className="font-semibold text-foreground">{Number(r.fare_amount)} ₸</span>}
                    {r.distance_km != null && <span>{Number(r.distance_km).toFixed(1)} км</span>}
                    {rating != null && (
                      <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-warning text-warning" />{rating}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
