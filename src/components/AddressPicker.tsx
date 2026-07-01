import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { MapGL } from "@/components/MapGL";
import { geocode2gis, reverseGeocode2gis } from "@/lib/maps.functions";

export type PickedPoint = { lat: number; lng: number; address: string };

type Props = {
  label: string;
  color?: string;
  initialPoint?: PickedPoint | null;
  onChange: (p: PickedPoint | null) => void;
  showMyLocation?: boolean;
};

<<<<<<< HEAD
export function AddressPicker({
  label,
  color = "#2563eb",
  initialPoint,
  onChange,
  showMyLocation,
}: Props) {
  const geocode = useServerFn(geocode2gis);
  const reverse = useServerFn(reverseGeocode2gis);
  const [query, setQuery] = useState(initialPoint?.address ?? "");
  const [results, setResults] = useState<
    Array<{ name: string; address: string; lat: number; lng: number }>
  >([]);
=======
export function AddressPicker({ label, color = "#2563eb", initialPoint, onChange, showMyLocation }: Props) {
  const geocode = useServerFn(geocode2gis);
  const reverse = useServerFn(reverseGeocode2gis);
  const [query, setQuery] = useState(initialPoint?.address ?? "");
  const [results, setResults] = useState<Array<{ name: string; address: string; lat: number; lng: number }>>([]);
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [point, setPoint] = useState<PickedPoint | null>(initialPoint ?? null);
  const [mapOpen, setMapOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!query || query === point?.address) {
      setResults([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await geocode({ data: { q: query } });
        setResults(res.items);
        setOpen(true);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, geocode, point?.address]);

  function pick(p: PickedPoint) {
    setPoint(p);
    setQuery(p.address);
    setOpen(false);
    setResults([]);
    onChange(p);
  }

  async function pickFromMap(coords: { lat: number; lng: number }) {
    const res = await reverse({ data: coords });
<<<<<<< HEAD
    pick({
      lat: coords.lat,
      lng: coords.lng,
      address: res.address ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
    });
=======
    pick({ lat: coords.lat, lng: coords.lng, address: res.address ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` });
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => pickFromMap({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MapPin className="h-4 w-4" style={{ color }} />
        {label}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (point) {
              setPoint(null);
              onChange(null);
            }
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Поиск адреса или места"
          className="pl-9 pr-9"
          maxLength={250}
        />
<<<<<<< HEAD
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
=======
        {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        {!searching && query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setPoint(null);
              setResults([]);
              setOpen(false);
              onChange(null);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {open && results.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-lg">
            {results.map((r, i) => (
              <button
                key={`${r.lat}-${r.lng}-${i}`}
                type="button"
                onClick={() => pick({ lat: r.lat, lng: r.lng, address: r.address || r.name })}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <div className="font-medium">{r.name || r.address}</div>
<<<<<<< HEAD
                {r.address && r.name && (
                  <div className="text-xs text-muted-foreground">{r.address}</div>
                )}
=======
                {r.address && r.name && <div className="text-xs text-muted-foreground">{r.address}</div>}
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setMapOpen((v) => !v)}>
          {mapOpen ? "Скрыть карту" : "Выбрать на карте"}
        </Button>
        {showMyLocation && (
          <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
            Моё местоположение
          </Button>
        )}
      </div>
      {mapOpen && (
        <div className="overflow-hidden rounded-lg border">
          <MapGL
            className="h-56 w-full sm:h-64"
            center={point ?? undefined}
            zoom={point ? 15 : 11}
            markers={point ? [{ id: "pick", lat: point.lat, lng: point.lng, color, label }] : []}
            onClick={pickFromMap}
            fitMarkers={false}
          />
<<<<<<< HEAD
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Коснитесь карты, чтобы выбрать точку.
          </p>
=======
          <p className="px-3 py-2 text-xs text-muted-foreground">Коснитесь карты, чтобы выбрать точку.</p>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        </div>
      )}
    </div>
  );
}
