import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRideDropoffPin(rideId: string | null | undefined, enabled: boolean) {
  const [pin, setPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rideId || !enabled) {
      setPin(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    void (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("ride_dropoff_pins")
          .select("pin_code")
          .eq("ride_id", rideId)
          .maybeSingle();
        if (!mounted) return;
        setPin(data?.pin_code ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [rideId, enabled]);

  return { pin, loading };
}
