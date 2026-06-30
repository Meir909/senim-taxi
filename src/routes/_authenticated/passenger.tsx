import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, MapPin, Search, X, Crosshair } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { MapGL, type MapMarker } from "@/components/MapGL";
import { geocode2gis, reverseGeocode2gis, getRoute2gis } from "@/lib/maps.functions";
import { TARIFFS, calcFare, fmtKzt, type Tariff } from "@/lib/fare";
import tariffStandardImg from "@/assets/tariff-standard.jpg";
import tariffKidsImg from "@/assets/tariff-kids.jpg";


type Ride = Database["public"]["Tables"]["rides"]["Row"];
type Point = { lat: number; lng: number; address: string };
type Field = "pickup" | "dropoff";

export const Route = createFileRoute("/_authenticated/passenger")({
  component: PassengerHome,
});

function PassengerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickup, setPickup] = useState<Point | null>(null);
  const [dropoff, setDropoff] = useState<Point | null>(null);
  const [pickerField, setPickerField] = useState<Field | null>(null);
  const [tapField, setTapField] = useState<Field | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const reverse = useServerFn(reverseGeocode2gis);
  const fetchRoute = useServerFn(getRoute2gis);
  const [route, setRoute] = useState<{ coords: Array<[number, number]>; distance_m: number; duration_s: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [tariff, setTariff] = useState<Tariff>("standard");


  useEffect(() => {
    if (!pickup || !dropoff) { setRoute(null); return; }
    let cancelled = false;
    setRouteLoading(true);
    void fetchRoute({ data: { pickup: { lat: pickup.lat, lng: pickup.lng }, dropoff: { lat: dropoff.lat, lng: dropoff.lng } } })
      .then((r) => {
        if (cancelled) return;
        if (r.coordinates.length >= 2) {
          setRoute({ coords: r.coordinates as Array<[number, number]>, distance_m: r.distance_m, duration_s: r.duration_s });
        } else {
          setRoute(null);
        }
      })
      .catch(() => { if (!cancelled) setRoute(null); })
      .finally(() => { if (!cancelled) setRouteLoading(false); });
    return () => { cancelled = true; };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, fetchRoute]);

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
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (activeRide) {
      void navigate({ to: "/passenger/ride/$rideId", params: { rideId: activeRide.id }, replace: true });
    }
  }, [activeRide, navigate]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCenter({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 6000 },
    );
  }, []);

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (pickup) m.push({ id: "pickup", lat: pickup.lat, lng: pickup.lng, color: "#16a34a", label: "A" });
    if (dropoff) m.push({ id: "dropoff", lat: dropoff.lat, lng: dropoff.lng, color: "#2563eb", label: "B" });
    return m;
  }, [pickup, dropoff]);

  async function handleMapTap(coords: { lat: number; lng: number }) {
    const target: Field = tapField ?? (!pickup ? "pickup" : !dropoff ? "dropoff" : "pickup");
    const res = await reverse({ data: coords });
    const point: Point = {
      lat: coords.lat,
      lng: coords.lng,
      address: res.address ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
    };
    if (target === "pickup") setPickup(point); else setDropoff(point);
    setTapField(null);
    toast.success(`Точка ${target === "pickup" ? "A" : "B"} установлена`);
  }

  function useMyLocation(field: Field) {
    if (!navigator.geolocation) { toast.error("Геолокация недоступна"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => void handleMapTap({ lat: p.coords.latitude, lng: p.coords.longitude }).then(() => setTapField(null)),
      () => toast.error("Не удалось получить координаты"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
    setTapField(field);
  }

  async function handleRequest() {
    if (!user || !pickup || !dropoff) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("rides")
        .insert({
          passenger_id: user.id,
          pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_address: pickup.address,
          dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, dropoff_address: dropoff.address,
          status: "searching",
        })
        .select().single();
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
    <div className="relative -mx-4 -my-4 sm:-my-6 h-[calc(100dvh-9rem)] overflow-hidden">
      <MapGL
        className="absolute inset-0 h-full w-full"
        markers={markers}
        polyline={route?.coords}
        polylineColor="#2563eb"
        center={pickup ?? dropoff ?? center}
        zoom={pickup || dropoff ? 14 : 12}
        onClick={handleMapTap}
        fitMarkers
      />

      {tapField && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-foreground/90 px-3 py-1.5 text-xs font-medium text-background shadow-lg">
          Коснитесь карты, чтобы выбрать точку {tapField === "pickup" ? "A" : "B"}
        </div>
      )}

      <div className="absolute inset-x-3 bottom-3 z-10">
        <Card className="space-y-3 p-4 shadow-xl">
          <FieldButton
            color="#16a34a"
            label="Откуда"
            placeholder="Выберите точку отправления"
            point={pickup}
            onPick={() => setPickerField("pickup")}
            onTapMap={() => setTapField("pickup")}
            onClear={() => setPickup(null)}
            onMyLocation={() => useMyLocation("pickup")}
            tapActive={tapField === "pickup"}
          />
          <FieldButton
            color="#2563eb"
            label="Куда"
            placeholder="Выберите точку назначения"
            point={dropoff}
            onPick={() => setPickerField("dropoff")}
            onTapMap={() => setTapField("dropoff")}
            onClear={() => setDropoff(null)}
            tapActive={tapField === "dropoff"}
          />
          {pickup && dropoff && (
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs">
              {routeLoading ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Строим оптимальный маршрут…
                </span>
              ) : route ? (
                <>
                  <span className="font-medium">
                    {(route.distance_m / 1000).toFixed(1)} км
                  </span>
                  <span className="text-muted-foreground">
                    ≈ {Math.max(1, Math.round(route.duration_s / 60))} мин в пути
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Маршрут недоступен</span>
              )}
            </div>
          )}
          <Button onClick={handleRequest} disabled={!ready} size="lg" className="w-full">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Заказать поездку
          </Button>
        </Card>
      </div>


      <AddressSearchDialog
        open={pickerField !== null}
        onOpenChange={(v) => !v && setPickerField(null)}
        title={pickerField === "pickup" ? "Откуда" : "Куда"}
        onPick={(p) => {
          if (pickerField === "pickup") setPickup(p);
          else if (pickerField === "dropoff") setDropoff(p);
          setPickerField(null);
        }}
      />
    </div>
  );
}

function FieldButton({
  color, label, placeholder, point, onPick, onTapMap, onClear, onMyLocation, tapActive,
}: {
  color: string; label: string; placeholder: string;
  point: Point | null;
  onPick: () => void; onTapMap: () => void; onClear: () => void;
  onMyLocation?: () => void; tapActive?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 shrink-0" style={{ color }} />
      <button
        type="button"
        onClick={onPick}
        className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-accent"
      >
        {point ? (
          <span className="block truncate">{point.address}</span>
        ) : (
          <span className="block truncate text-muted-foreground">{placeholder}</span>
        )}
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </button>
      {point ? (
        <Button size="icon" variant="ghost" onClick={onClear} aria-label="Очистить">
          <X className="h-4 w-4" />
        </Button>
      ) : (
        <>
          {onMyLocation && (
            <Button size="icon" variant="ghost" onClick={onMyLocation} aria-label="Моя локация">
              <Crosshair className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant={tapActive ? "default" : "outline"}
            onClick={onTapMap}
            aria-label="Указать на карте"
          >
            <MapPin className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function AddressSearchDialog({
  open, onOpenChange, title, onPick,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string;
  onPick: (p: Point) => void;
}) {
  const geocode = useServerFn(geocode2gis);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ name: string; address: string; lat: number; lng: number }>>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); return; }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return; }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await geocode({ data: { q: query.trim() } });
        setResults(res.items);
      } finally { setSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query, geocode, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-hidden">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск адреса или места"
              className="pl-9"
              maxLength={250}
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-[50dvh] overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                {query.trim().length < 2 ? "Начните вводить адрес" : searching ? "Поиск…" : "Ничего не найдено"}
              </p>
            ) : (
              results.map((r, i) => (
                <button
                  key={`${r.lat}-${r.lng}-${i}`}
                  type="button"
                  onClick={() => onPick({ lat: r.lat, lng: r.lng, address: r.address || r.name })}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <div className="font-medium">{r.name || r.address}</div>
                  {r.address && r.name && <div className="text-xs text-muted-foreground">{r.address}</div>}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
