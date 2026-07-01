import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
<<<<<<< HEAD
import {
  loadMapGL,
  type MapGlClickEvent,
  type MapGlMap,
  type MapGlMarker,
  type MapGlNamespace,
  type MapGlPolyline,
} from "@/lib/mapgl-loader";
=======
import { loadMapGL } from "@/lib/mapgl-loader";
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
import { getMap2gisKey } from "@/lib/maps.functions";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
<<<<<<< HEAD
  color?: string;
=======
  color?: string; // hex
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  label?: string;
};

type Props = {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
<<<<<<< HEAD
=======
  /** Optional polyline coordinates as [lng, lat] pairs (e.g. driving route). */
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  polyline?: Array<[number, number]>;
  polylineColor?: string;
  className?: string;
  onClick?: (coords: { lat: number; lng: number }) => void;
<<<<<<< HEAD
  fitMarkers?: boolean;
};

const DEFAULT_CENTER = { lat: 51.1694, lng: 71.4491 };

export function MapGL({
  center,
  zoom = 13,
  markers = [],
  polyline,
  polylineColor = "#2563eb",
  className,
  onClick,
  fitMarkers = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapGlMap | null>(null);
  const markersRef = useRef<Map<string, MapGlMarker>>(new Map());
  const polylineRef = useRef<MapGlPolyline | null>(null);
  const onClickRef = useRef(onClick);
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  onClickRef.current = onClick;
  centerRef.current = center;
  zoomRef.current = zoom;
=======
  /** Auto-fit bounds to markers when count >= 2. */
  fitMarkers?: boolean;
};

const DEFAULT_CENTER = { lat: 55.7558, lng: 37.6173 }; // Moscow fallback

export function MapGL({ center, zoom = 13, markers = [], polyline, polylineColor = "#2563eb", className, onClick, fitMarkers = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const polylineRef = useRef<any>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231

  const getKey = useServerFn(getMap2gisKey);
  const { data: keyData, isLoading: keyLoading } = useQuery({
    queryKey: ["map2gis-key"],
    queryFn: () => getKey(),
    staleTime: Infinity,
  });

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

<<<<<<< HEAD
  useEffect(() => {
    const key = keyData?.key;
    if (!key || !containerRef.current) return;
    let cancelled = false;
    const markerStore = markersRef.current;
    loadMapGL()
      .then((mapgl: MapGlNamespace) => {
        if (cancelled || !containerRef.current) return;
        const c = centerRef.current ?? DEFAULT_CENTER;
        const map = new mapgl.Map(containerRef.current, {
          center: [c.lng, c.lat],
          zoom: zoomRef.current,
          key,
        });
        mapRef.current = map;
        const clickHandler = (e: MapGlClickEvent) => {
=======
  // init map once key is available
  useEffect(() => {
    if (!keyData?.key || !containerRef.current) return;
    let cancelled = false;
    let clickHandler: any;
    loadMapGL()
      .then((mapgl) => {
        if (cancelled || !containerRef.current) return;
        const c = center ?? DEFAULT_CENTER;
        const map = new mapgl.Map(containerRef.current, {
          center: [c.lng, c.lat],
          zoom,
          key: keyData.key,
        });
        mapRef.current = map;
        clickHandler = (e: any) => {
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
          const [lng, lat] = e.lngLat;
          onClickRef.current?.({ lat, lng });
        };
        map.on("click", clickHandler);
        setReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Map failed to load"));
    return () => {
      cancelled = true;
<<<<<<< HEAD
      markerStore.forEach((marker) => marker.destroy());
      markerStore.clear();
      if (polylineRef.current) {
        try {
          polylineRef.current.destroy();
        } catch {
          // noop
        }
=======
      markersRef.current.forEach((m) => m.destroy());
      markersRef.current.clear();
      if (polylineRef.current) {
        try { polylineRef.current.destroy(); } catch { /* noop */ }
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        polylineRef.current = null;
      }
      if (mapRef.current) {
        try {
          mapRef.current.destroy();
        } catch {
<<<<<<< HEAD
          // noop
=======
          /* noop */
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        }
        mapRef.current = null;
      }
      setReady(false);
    };
<<<<<<< HEAD
  }, [keyData?.key]);

  useEffect(() => {
    if (!ready || !mapRef.current || !center) return;
    mapRef.current.setCenter([center.lng, center.lat]);
  }, [ready, center]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setZoom(zoom);
  }, [ready, zoom]);

=======
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyData?.key]);

  // recenter when center prop changes
  useEffect(() => {
    if (!ready || !mapRef.current || !center) return;
    mapRef.current.setCenter([center.lng, center.lat]);
  }, [ready, center?.lat, center?.lng]);

  // sync markers
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapgl) return;
    const mapgl = window.mapgl;
    const existing = markersRef.current;
    const incomingIds = new Set(markers.map((m) => m.id));
<<<<<<< HEAD
=======
    // remove gone
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    existing.forEach((m, id) => {
      if (!incomingIds.has(id)) {
        m.destroy();
        existing.delete(id);
      }
    });
<<<<<<< HEAD
=======
    // add/update
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    for (const m of markers) {
      const prev = existing.get(m.id);
      if (prev) {
        prev.setCoordinates([m.lng, m.lat]);
      } else {
        const marker = new mapgl.Marker(mapRef.current, {
          coordinates: [m.lng, m.lat],
          icon: makeMarkerIcon(m.color ?? "#2563eb", m.label),
          size: [32, 42],
          anchor: [16, 42],
        });
        existing.set(m.id, marker);
      }
    }
<<<<<<< HEAD
=======
    // fit
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    if (fitMarkers && markers.length >= 2) {
      const lats = markers.map((m) => m.lat);
      const lngs = markers.map((m) => m.lng);
      try {
        mapRef.current.fitBounds(
          {
            southWest: [Math.min(...lngs), Math.min(...lats)],
            northEast: [Math.max(...lngs), Math.max(...lats)],
          },
          { padding: { top: 60, right: 60, bottom: 60, left: 60 } },
        );
      } catch {
<<<<<<< HEAD
        // noop
=======
        /* noop */
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      }
    }
  }, [ready, markers, fitMarkers]);

<<<<<<< HEAD
=======
  // sync polyline (route)
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapgl) return;
    const mapgl = window.mapgl;
    if (polylineRef.current) {
<<<<<<< HEAD
      try {
        polylineRef.current.destroy();
      } catch {
        // noop
      }
=======
      try { polylineRef.current.destroy(); } catch { /* noop */ }
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      polylineRef.current = null;
    }
    if (polyline && polyline.length >= 2) {
      try {
        polylineRef.current = new mapgl.Polyline(mapRef.current, {
          coordinates: polyline,
          width: 5,
          color: polylineColor,
          color2: "#ffffff",
          width2: 7,
        });
      } catch {
<<<<<<< HEAD
        // noop
=======
        /* noop */
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      }
      if (fitMarkers) {
        const lngs = polyline.map((p) => p[0]);
        const lats = polyline.map((p) => p[1]);
        try {
          mapRef.current.fitBounds(
            {
              southWest: [Math.min(...lngs), Math.min(...lats)],
              northEast: [Math.max(...lngs), Math.max(...lats)],
            },
            { padding: { top: 60, right: 60, bottom: 200, left: 60 } },
          );
<<<<<<< HEAD
        } catch {
          // noop
        }
=======
        } catch { /* noop */ }
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      }
    }
  }, [ready, polyline, polylineColor, fitMarkers]);

<<<<<<< HEAD
=======

>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  if (keyLoading) {
    return (
      <div className={`grid place-items-center bg-muted ${className ?? ""}`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!keyData?.key) {
    return (
<<<<<<< HEAD
      <div
        className={`grid place-items-center bg-muted p-4 text-center text-xs text-muted-foreground ${className ?? ""}`}
      >
=======
      <div className={`grid place-items-center bg-muted p-4 text-center text-xs text-muted-foreground ${className ?? ""}`}>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        Map unavailable — 2GIS key not configured.
      </div>
    );
  }
  if (error) {
    return (
<<<<<<< HEAD
      <div
        className={`grid place-items-center bg-muted p-4 text-center text-xs text-destructive ${className ?? ""}`}
      >
=======
      <div className={`grid place-items-center bg-muted p-4 text-center text-xs text-destructive ${className ?? ""}`}>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        {error}
      </div>
    );
  }
  return <div ref={containerRef} className={className} />;
}

function makeMarkerIcon(color: string, label?: string): string {
  const txt = (label ?? "").slice(0, 1).toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='42' viewBox='0 0 32 42'><path d='M16 0C7.2 0 0 7 0 15.6 0 27 16 42 16 42s16-15 16-26.4C32 7 24.8 0 16 0z' fill='${color}'/><circle cx='16' cy='15' r='8' fill='white'/><text x='16' y='19' text-anchor='middle' font-family='system-ui,sans-serif' font-size='11' font-weight='700' fill='${color}'>${txt}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
