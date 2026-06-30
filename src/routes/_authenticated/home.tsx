import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomeRedirect,
});

function HomeRedirect() {
  const { loading, isDriver } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading) void navigate({ to: isDriver ? "/driver" : "/passenger", replace: true });
  }, [loading, isDriver, navigate]);
  return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}
