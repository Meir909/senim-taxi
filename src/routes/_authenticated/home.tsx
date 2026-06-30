import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
      if (status === "reupload_requested" || status === "rejected") {
        void navigate({ to: "/verify-identity", replace: true });
        return;
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
