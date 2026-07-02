import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FALLBACK_TWOGIS_KEY = "9af03ad6-f0a9-40da-a9f3-2445305076de";

function get2gisKey() {
  return (
    process.env.TWOGIS_MAPGL_API_KEY ||
    process.env.TWOGIS_API_KEY ||
    process.env.VITE_TWOGIS_MAPGL_API_KEY ||
    FALLBACK_TWOGIS_KEY
  );
}

export const getMap2gisKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = get2gisKey();
  if (!key) return { key: null as string | null };
  return { key };
});

const geocodeSchema = z.object({ q: z.string().min(2).max(200) });

export const geocode2gis = createServerFn({ method: "POST" })
  .validator((d: unknown) => geocodeSchema.parse(d))
  .handler(async ({ data }) => {
    const key = get2gisKey();
    if (!key)
      return { items: [] as Array<{ name: string; address: string; lat: number; lng: number }> };
    const url = new URL("https://catalog.api.2gis.com/3.0/items/geocode");
    url.searchParams.set("q", data.q);
    url.searchParams.set("fields", "items.point,items.full_address_name");
    url.searchParams.set("page_size", "8");
    url.searchParams.set("key", key);
    try {
      const res = await fetch(url.toString());
      if (!res.ok) return { items: [] };
      const json = (await res.json()) as {
        result?: {
          items?: Array<{
            name?: string;
            full_address_name?: string;
            address_name?: string;
            point?: { lat: number; lon: number };
          }>;
        };
      };
      const items = (json.result?.items ?? [])
        .filter((i) => i.point)
        .map((i) => ({
          name: i.name ?? "",
          address: i.full_address_name ?? i.address_name ?? "",
          lat: i.point!.lat,
          lng: i.point!.lon,
        }));
      return { items };
    } catch {
      return { items: [] };
    }
  });

export const reverseGeocode2gis = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ lat: z.number(), lng: z.number() }).parse(d))
  .handler(async ({ data }) => {
    const key = get2gisKey();
    if (!key) return { address: null as string | null };
    const url = new URL("https://catalog.api.2gis.com/3.0/items/geocode");
    url.searchParams.set("lat", String(data.lat));
    url.searchParams.set("lon", String(data.lng));
    url.searchParams.set("fields", "items.full_address_name");
    url.searchParams.set("key", key);
    try {
      const res = await fetch(url.toString());
      if (!res.ok) return { address: null };
      const json = (await res.json()) as {
        result?: { items?: Array<{ full_address_name?: string; name?: string }> };
      };
      const top = json.result?.items?.[0];
      return { address: top?.full_address_name ?? top?.name ?? null };
    } catch {
      return { address: null };
    }
  });

const routeSchema = z.object({
  pickup: z.object({ lat: z.number(), lng: z.number() }),
  dropoff: z.object({ lat: z.number(), lng: z.number() }),
});

type RoutePoint = [number, number];

function haversineDistanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
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

function buildFallbackRoute(data: z.infer<typeof routeSchema>) {
  const distance_m = Math.round(haversineDistanceM(data.pickup, data.dropoff));
  const avgCitySpeedKmh = 28;
  const duration_s = Math.max(60, Math.round((distance_m / 1000 / avgCitySpeedKmh) * 3600));
  return {
    coordinates: [
      [data.pickup.lng, data.pickup.lat],
      [data.dropoff.lng, data.dropoff.lat],
    ] as RoutePoint[],
    distance_m,
    duration_s,
  };
}

function parseLineString(wkt: string): RoutePoint[] {
  const m = wkt.match(/LINESTRING\s*\(([^)]+)\)/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((pair) => pair.trim().split(/\s+/).map(Number))
    .filter((p) => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [p[0], p[1]] as RoutePoint);
}

export const getRoute2gis = createServerFn({ method: "POST" })
  .validator((d: unknown) => routeSchema.parse(d))
  .handler(async ({ data }) => {
    const key = get2gisKey();
    if (!key) return buildFallbackRoute(data);
    try {
      const res = await fetch(
        `https://routing.api.2gis.com/routing/7.0.0/global?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: [
              { type: "stop", lat: data.pickup.lat, lon: data.pickup.lng },
              { type: "stop", lat: data.dropoff.lat, lon: data.dropoff.lng },
            ],
            transport: "driving",
            route_mode: "fastest",
            traffic_mode: "disabled",
            output: "detailed",
          }),
        },
      );
      if (!res.ok) return buildFallbackRoute(data);
      const json = (await res.json()) as {
        result?: Array<{
          total_distance?: number;
          total_duration?: number;
          maneuvers?: Array<{ outcoming_path?: { geometry?: Array<{ selection?: string }> } }>;
        }>;
      };
      const r = json.result?.[0];
      if (!r) return buildFallbackRoute(data);
      const coords: RoutePoint[] = [];
      for (const mv of r.maneuvers ?? []) {
        for (const g of mv.outcoming_path?.geometry ?? []) {
          if (g.selection) {
            const pts = parseLineString(g.selection);
            const start =
              coords.length &&
              pts.length &&
              coords[coords.length - 1][0] === pts[0][0] &&
              coords[coords.length - 1][1] === pts[0][1]
                ? 1
                : 0;
            for (let i = start; i < pts.length; i++) coords.push(pts[i]);
          }
        }
      }
      if (coords.length < 2) {
        return buildFallbackRoute(data);
      }
      return {
        coordinates: coords,
        distance_m: r.total_distance ?? 0,
        duration_s: r.total_duration ?? 0,
      };
    } catch {
      return buildFallbackRoute(data);
    }
  });
