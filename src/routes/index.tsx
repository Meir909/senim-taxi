import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Senim — Поездка за секунды" },
      { name: "description", content: "Закажите такси или станьте водителем в Senim." },
    ],
  }),
  ssr: false,
  component: Entry,
});

function Entry() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <Navigate to={user ? "/home" : "/auth"} replace />;
}
