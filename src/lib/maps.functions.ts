import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Returns the public 2GIS MapGL key (safe to expose; restricted by referrer at 2GIS). */
export const getMap2gisKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.TWOGIS_MAPGL_API_KEY;
  if (!key) return { key: null as string | null };
  return { key };
});

const geocodeSchema = z.object({ q: z.string().min(2).max(200) });

export const geocode2gis = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => geocodeSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.TWOGIS_MAPGL_API_KEY;
    if (!key) return { items: [] as Array<{ name: string; address: string; lat: number; lng: number }> };
    const url = new URL("https://catalog.api.2gis.com/3.0/items/geocode");
    url.searchParams.set("q", data.q);
    url.searchParams.set("fields", "items.point,items.full_address_name");
    url.searchParams.set("page_size", "8");
    url.searchParams.set("key", key);
    try {
      const res = await fetch(url.toString());
      if (!res.ok) return { items: [] };
      const json = (await res.json()) as {
        result?: { items?: Array<{ name?: string; full_address_name?: string; address_name?: string; point?: { lat: number; lon: number } }> };
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
  .inputValidator((d: unknown) => z.object({ lat: z.number(), lng: z.number() }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.TWOGIS_MAPGL_API_KEY;
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
