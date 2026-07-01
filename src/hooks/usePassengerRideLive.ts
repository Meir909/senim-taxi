import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Driver, Loc, Profile, Ride } from "@/lib/passenger-rides";

type PassengerRideLiveState = {
  ride: Ride | null;
  driver: Driver | null;
  driverProfile: Profile | null;
  driverLoc: Loc | null;
  locError: string | null;
  loading: boolean;
};

export function usePassengerRideLive(rideId: string): PassengerRideLiveState {
  const [ride, setRide] = useState<Ride | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [driverProfile, setDriverProfile] = useState<Profile | null>(null);
  const [driverLoc, setDriverLoc] = useState<Loc | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setRide(null);

    async function loadRide(attempt = 0) {
      const { data, error } = await supabase.from("rides").select("*").eq("id", rideId).maybeSingle();
      if (!mounted) return;

      if (data) {
        setRide(data);
        setLoading(false);
        return;
      }

      if (attempt < 5) {
        window.setTimeout(() => {
          if (mounted) void loadRide(attempt + 1);
        }, 800);
        return;
      }

      if (error) {
        console.warn("ride load failed", error);
      }
      setLoading(false);
    }

    void loadRide();

    const channel = supabase
      .channel(`ride-${rideId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `id=eq.${rideId}` },
        (payload) => {
          setRide((payload.new as Ride | null) ?? null);
          setLoading(false);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [rideId]);

  useEffect(() => {
    if (!ride?.driver_id) {
      setDriver(null);
      setDriverProfile(null);
      setDriverLoc(null);
      setLocError(null);
      return;
    }

    const driverId = ride.driver_id;
    let mounted = true;
    let attempt = 0;
    let retryTimer: number | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function fetchLoc(): Promise<Loc | null> {
      const { data, error } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("driver_id", driverId)
        .maybeSingle();

      if (error) throw error;
      return data;
    }

    async function loadDriverState() {
      try {
        const [loc, { data: driverData }, { data: profileData }] = await Promise.all([
          fetchLoc(),
          supabase.from("drivers").select("*").eq("id", driverId).maybeSingle(),
          supabase.from("profiles").select("*").eq("id", driverId).maybeSingle(),
        ]);

        if (!mounted) return;
        setDriverLoc(loc);
        setDriver(driverData);
        setDriverProfile(profileData);
        setLocError(null);
        attempt = 0;
      } catch (error) {
        if (!mounted) return;
        setLocError(error instanceof Error ? error.message : "Не удалось получить координаты");
        const delay = Math.min(20_000, 1500 * 2 ** attempt);
        attempt += 1;
        retryTimer = window.setTimeout(loadDriverState, delay);
      }
    }

    async function refetchLoc() {
      try {
        const loc = await fetchLoc();
        if (!mounted) return;
        setDriverLoc(loc);
        setLocError(null);
      } catch (error) {
        if (!mounted) return;
        setLocError(error instanceof Error ? error.message : "Связь с водителем нестабильна");
      }
    }

    function subscribeToLocations() {
      channel = supabase
        .channel(`driver-loc-${rideId}-${driverId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "driver_locations",
            filter: `driver_id=eq.${driverId}`,
          },
          (payload) => {
            setDriverLoc(payload.new as Loc);
            setLocError(null);
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setLocError("Переподключение к обновлениям…");
            if (channel) supabase.removeChannel(channel);
            channel = null;
            window.setTimeout(() => {
              if (mounted) subscribeToLocations();
            }, 2500);
          }
        });
    }

    void loadDriverState();
    subscribeToLocations();
    const pollTimer = window.setInterval(() => {
      void refetchLoc();
    }, 8000);

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [ride?.driver_id, rideId]);

  return { ride, driver, driverProfile, driverLoc, locError, loading };
}
