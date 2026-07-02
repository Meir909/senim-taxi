import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Baby, Loader2, MapPin, Search, ShieldCheck, X, Crosshair } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { MapGL, type MapMarker } from "@/components/MapGL";
import { PassengerChildrenCard } from "@/components/PassengerChildrenCard";
import { usePassengerChildren } from "@/hooks/usePassengerChildren";
import { geocode2gis, reverseGeocode2gis, getRoute2gis } from "@/lib/maps.functions";
import { TARIFFS, calcFare, fmtKzt, type Tariff } from "@/lib/fare";
import { formatChildMeta } from "@/lib/passenger-children";
import { getPassengerRideRoute, primePassengerRideSnapshot } from "@/lib/passenger-rides";
import { normalizePhone } from "@/lib/phone";
import tariffStandardImg from "@/assets/tariff-standard.jpg";
import tariffKidsImg from "@/assets/tariff-kids.jpg";
import tariffDeliveryImg from "@/assets/tariff-delivery.jpg";
import tariffCargoImg from "@/assets/tariff-cargo.jpg";

const TARIFF_IMAGES: Record<Tariff, string> = {
  standard: tariffStandardImg,
  kids: tariffKidsImg,
  delivery: tariffDeliveryImg,
  cargo: tariffCargoImg,
};

function haversineDistanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function buildFallbackTripMetrics(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
) {
  const distance_m = Math.round(haversineDistanceM(pickup, dropoff));
  const avgCitySpeedKmh = 28;
  const duration_s = Math.max(60, Math.round((distance_m / 1000 / avgCitySpeedKmh) * 3600));
  return { distance_m, duration_s };
}

type Ride = Database["public"]["Tables"]["rides"]["Row"];
type Point = { lat: number; lng: number; address: string };
type Field = "pickup" | "dropoff";

export const Route = createFileRoute("/_authenticated/passenger")({
  component: PassengerHome,
});

function PassengerHome() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const {
    profile,
    children,
    eligibleMother,
    loading: childrenLoading,
    reload: reloadChildren,
  } = usePassengerChildren(user?.id);
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
  const [route, setRoute] = useState<{
    coords: Array<[number, number]>;
    distance_m: number;
    duration_s: number;
  } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [tariff, setTariff] = useState<Tariff>("standard");
  const [requiresChildSeat, setRequiresChildSeat] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [recipientFullName, setRecipientFullName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientRelation, setRecipientRelation] = useState("");

  const hasDriverRole = roles.includes("driver");
  const canUseKidsTariff = !hasDriverRole && eligibleMother && children.length > 0;
  const isIdentityVerified = profile?.verification_status === "approved";
  const selectedChild = children.find((child) => child.id === selectedChildId) ?? null;

  useEffect(() => {
    if (!pickup || !dropoff) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    void fetchRoute({
      data: {
        pickup: { lat: pickup.lat, lng: pickup.lng },
        dropoff: { lat: dropoff.lat, lng: dropoff.lng },
      },
    })
      .then((r) => {
        if (cancelled) return;
        if (r.coordinates.length >= 2) {
          setRoute({
            coords: r.coordinates as Array<[number, number]>,
            distance_m: r.distance_m,
            duration_s: r.duration_s,
          });
        } else {
          setRoute(null);
        }
      })
      .catch(() => {
        if (!cancelled) setRoute(null);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, fetchRoute]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq("passenger_id", user.id)
        .in("status", [
          "requested",
          "searching",
          "accepted",
          "driver_arriving",
          "driver_arrived",
          "in_progress",
        ])
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) {
        primePassengerRideSnapshot(data);
        setActiveRide(data);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!activeRide) return;
    primePassengerRideSnapshot(activeRide);
    const isOnRideRoute = pathname.startsWith(`/passenger/ride/${activeRide.id}`);
    if (isOnRideRoute) return;
    void navigate({
      to: getPassengerRideRoute(activeRide.status),
      params: { rideId: activeRide.id },
      replace: true,
    });
  }, [activeRide, navigate, pathname]);

  useEffect(() => {
    if (!user || childrenLoading) return;
    if (
      profile &&
      profile.verification_status !== "approved"
    ) {
      toast.error("Сначала подтвердите личность");
      void navigate({ to: "/verify-identity", replace: true });
    }
  }, [user, profile, childrenLoading, navigate]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCenter({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 6000 },
    );
  }, []);

  useEffect(() => {
    if (tariff !== "kids") return;
    if (!canUseKidsTariff) {
      setTariff("standard");
      return;
    }
    if (!selectedChildId && children[0]) {
      setSelectedChildId(children[0].id);
    }
  }, [tariff, canUseKidsTariff, selectedChildId, children]);

  useEffect(() => {
    if (tariff === "kids") return;
    setRecipientFullName("");
    setRecipientPhone("");
    setRecipientRelation("");
  }, [tariff]);

  useEffect(() => {
    if (tariff === "standard" || tariff === "kids") return;
    setRequiresChildSeat(false);
  }, [tariff]);

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (pickup)
      m.push({ id: "pickup", lat: pickup.lat, lng: pickup.lng, color: "#16a34a", label: "A" });
    if (dropoff)
      m.push({ id: "dropoff", lat: dropoff.lat, lng: dropoff.lng, color: "#2563eb", label: "B" });
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
    if (target === "pickup") setPickup(point);
    else setDropoff(point);
    setTapField(null);
    toast.success(`Точка ${target === "pickup" ? "A" : "B"} установлена`);
  }

  function handleMyLocation(field: Field) {
    if (!navigator.geolocation) {
      toast.error("Геолокация недоступна");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        void handleMapTap({ lat: p.coords.latitude, lng: p.coords.longitude }).then(() =>
          setTapField(null),
        ),
      () => toast.error("Не удалось получить координаты"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
    setTapField(field);
  }

  async function handleRequest() {
    if (!user || !pickup || !dropoff) return;
    if (!isIdentityVerified) {
      toast.error("Сначала подтвердите личность, чтобы создать заказ");
      return;
    }
    if (tariff === "kids" && !eligibleMother) {
      toast.error("Детский тариф доступен только совершеннолетним женщинам-пассажиркам");
      return;
    }
    if (tariff === "kids" && !selectedChild) {
      toast.error("Сначала выберите ребёнка для поездки");
      return;
    }
    if (
      tariff === "kids" &&
      (!recipientFullName.trim() || !recipientPhone.trim() || !recipientRelation.trim())
    ) {
      toast.error("Заполните данные получателя ребёнка");
      return;
    }
    setSubmitting(true);
    try {
      const tripMetrics = route ?? buildFallbackTripMetrics(pickup, dropoff);
      const fare = calcFare(
        tariff,
        tripMetrics.distance_m,
        tripMetrics.duration_s,
        requiresChildSeat,
      );
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
          tariff,
          child_id: tariff === "kids" ? selectedChild!.id : null,
          recipient_full_name: tariff === "kids" ? recipientFullName.trim() : null,
          recipient_phone: tariff === "kids" ? normalizePhone(recipientPhone) : null,
          recipient_relation: tariff === "kids" ? recipientRelation.trim() : null,
          requires_child_seat: requiresChildSeat,
          estimated_fare: fare,
          distance_km: Number((tripMetrics.distance_m / 1000).toFixed(2)),
          duration_min: Math.max(1, Math.round(tripMetrics.duration_s / 60)),
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Ищем водителя…");
      primePassengerRideSnapshot(data);
      setActiveRide(data);
      await navigate({
        to: getPassengerRideRoute(data.status),
        params: { rideId: data.id },
        replace: true,
      });
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
  if (activeRide) {
    return <Outlet />;
  }

  const ready =
    pickup &&
    dropoff &&
    isIdentityVerified &&
    !submitting &&
    (tariff !== "kids" ||
      (!!selectedChild &&
        !!recipientFullName.trim() &&
        !!recipientPhone.trim() &&
        !!recipientRelation.trim()));

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

      <div className="absolute inset-x-3 bottom-3 z-10 max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain pr-1">
        <Card className="space-y-3 p-4 shadow-xl">
          <FieldButton
            color="#16a34a"
            label="Откуда"
            placeholder="Выберите точку отправления"
            point={pickup}
            onPick={() => setPickerField("pickup")}
            onTapMap={() => setTapField("pickup")}
            onClear={() => setPickup(null)}
            onMyLocation={() => handleMyLocation("pickup")}
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
            <>
              {!isIdentityVerified && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Подтвердите личность в профиле, чтобы заказывать поездки.
                </div>
              )}
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs">
                {routeLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Строим оптимальный маршрут…
                  </span>
                ) : route ? (
                  <>
                    <span className="font-medium">{(route.distance_m / 1000).toFixed(1)} км</span>
                    <span className="text-muted-foreground">
                      ≈ {Math.max(1, Math.round(route.duration_s / 60))} мин в пути
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Маршрут недоступен</span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(["standard", "kids", "delivery", "cargo"] as const).map((id) => {
                  const t = TARIFFS[id];
                  const img = TARIFF_IMAGES[id];
                  const price = route
                    ? calcFare(
                        id,
                        route.distance_m,
                        route.duration_s,
                        requiresChildSeat && (id === "standard" || id === "kids"),
                      )
                    : null;
                  const active = tariff === id;
                  const disabled = id === "kids" && !canUseKidsTariff;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => !disabled && setTariff(id)}
                      className={`flex min-w-[5.5rem] flex-1 flex-col items-center gap-1 rounded-lg border p-2 text-center transition ${
                        active
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-foreground/40"
                      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                      disabled={disabled}
                    >
                      <img
                        src={img}
                        alt={t.name}
                        loading="lazy"
                        width={128}
                        height={128}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                      <div className="text-xs font-semibold leading-tight">{t.name}</div>
                      <div className="text-[11px] font-bold text-primary">
                        {price != null ? fmtKzt(price) : routeLoading ? "…" : "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
              {(tariff === "standard" || tariff === "kids") && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">С детским креслом</div>
                      <div className="text-xs text-muted-foreground">
                        Если включить, заказ увидят только водители с детским креслом.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {requiresChildSeat ? "Вкл" : "Выкл"}
                      </span>
                      <Switch
                        checked={requiresChildSeat}
                        onCheckedChange={setRequiresChildSeat}
                        aria-label="С детским креслом"
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-xs font-medium text-primary">
                    {requiresChildSeat
                      ? "Стоимость будет чуть выше из-за детского кресла."
                      : "Если кресло не нужно, заказ не ограничивается только такими водителями."}
                  </div>
                </div>
              )}
              {!canUseKidsTariff && (
                <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  {hasDriverRole
                    ? "Для аккаунтов с ролью водителя детский тариф и добавление детей недоступны."
                    : eligibleMother
                    ? "Чтобы воспользоваться тарифом «Ребёнок», сначала добавьте ребёнка до 12 лет в профиле."
                    : "Тариф «Ребёнок» доступен только совершеннолетним женщинам-пассажиркам."}
                </div>
              )}
              {tariff === "kids" && (
                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-start gap-2">
                    <Baby className="mt-0.5 h-4 w-4 text-primary" />
                    <div className="text-sm">
                      <div className="font-semibold">Поездка для ребёнка до 12 лет</div>
                      <div className="text-muted-foreground">
                        После принятия заказа мама получит PIN-код из 4 цифр. Водитель начнёт
                        поездку только после ввода этого кода.
                      </div>
                    </div>
                  </div>

                  {canUseKidsTariff ? (
                    <>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Выберите ребёнка
                      </div>
                      <div className="space-y-2">
                        {children.map((child) => {
                          const active = child.id === selectedChildId;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => setSelectedChildId(child.id)}
                              className={`flex w-full items-start justify-between rounded-xl border p-3 text-left transition ${
                                active
                                  ? "border-primary bg-background ring-2 ring-primary/20"
                                  : "border-border bg-background/70"
                              }`}
                            >
                              <div>
                                <div className="font-medium">{child.full_name}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {formatChildMeta(child)}
                                </div>
                              </div>
                              {active && <ShieldCheck className="h-4 w-4 text-primary" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid gap-2 pt-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Кому можно передать ребёнка в точке B
                        </div>
                        <Input
                          value={recipientFullName}
                          onChange={(e) => setRecipientFullName(e.target.value)}
                          placeholder="ФИО получателя"
                          maxLength={120}
                        />
                        <Input
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(normalizePhone(e.target.value))}
                          placeholder="Телефон получателя"
                          inputMode="tel"
                          maxLength={25}
                        />
                        <Input
                          value={recipientRelation}
                          onChange={(e) => setRecipientRelation(e.target.value)}
                          placeholder="Кем приходится: бабушка, тетя, няня..."
                          maxLength={60}
                        />
                        <div className="rounded-lg border border-primary/20 bg-background/70 p-3 text-xs text-muted-foreground">
                          В конце поездки водитель сможет передать ребёнка только этому получателю и
                          только после ввода отдельного PIN-кода.
                        </div>
                      </div>
                    </>
                  ) : !hasDriverRole ? (
                    <PassengerChildrenCard
                      motherId={user!.id}
                      eligible={eligibleMother}
                      children={children}
                      loading={childrenLoading}
                      onSaved={reloadChildren}
                    />
                  ) : null
                  }
                </div>
              )}
            </>
          )}
          <Button onClick={handleRequest} disabled={!ready} size="lg" className="w-full">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {route && pickup && dropoff
              ? `Заказать — ${fmtKzt(
                  calcFare(tariff, route.distance_m, route.duration_s, requiresChildSeat),
                )}`
              : isIdentityVerified
                ? "Заказать поездку"
                : "Подтвердите личность"}
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
  color,
  label,
  placeholder,
  point,
  onPick,
  onTapMap,
  onClear,
  onMyLocation,
  tapActive,
}: {
  color: string;
  label: string;
  placeholder: string;
  point: Point | null;
  onPick: () => void;
  onTapMap: () => void;
  onClear: () => void;
  onMyLocation?: () => void;
  tapActive?: boolean;
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
  open,
  onOpenChange,
  title,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  onPick: (p: Point) => void;
}) {
  const geocode = useServerFn(geocode2gis);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ name: string; address: string; lat: number; lng: number }>
  >([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await geocode({ data: { q: query.trim() } });
        setResults(res.items);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, geocode, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
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
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="max-h-[50dvh] overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                {query.trim().length < 2
                  ? "Начните вводить адрес"
                  : searching
                    ? "Поиск…"
                    : "Ничего не найдено"}
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
                  {r.address && r.name && (
                    <div className="text-xs text-muted-foreground">{r.address}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
