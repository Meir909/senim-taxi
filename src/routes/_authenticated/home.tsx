import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { isWaitingStatus } from "@/lib/passenger-rides";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomeRedirect,
});

function HomeRedirect() {
  const { loading, isDriver, user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("verification_status")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const status = data?.verification_status;
      if (status !== "approved") {
        void navigate({ to: "/verify-identity", replace: true });
        return;
      }
      if (!isDriver) {
        const { data: activeRide } = await supabase
          .from("rides")
          .select("id, status")
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
        if (cancelled) return;
        if (activeRide?.id) {
          void navigate({
            to: isWaitingStatus(activeRide.status)
              ? "/passenger/ride/$rideId/waiting"
              : "/passenger/ride/$rideId",
            params: { rideId: activeRide.id },
            replace: true,
          });
          return;
        }
      }
      void navigate({ to: isDriver ? "/driver" : "/passenger", replace: true });
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, isDriver, user, navigate]);

  if (loading || checking) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return null;
}
