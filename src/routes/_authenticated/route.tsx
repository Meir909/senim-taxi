import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Car, Wallet, User as UserIcon, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useRealtimeNotifications } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, isDriver, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { permission, requestPermission } = useRealtimeNotifications();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/home" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Car className="h-4 w-4" /></div>
            <span className="font-semibold">RideNow</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); void navigate({ to: "/auth", replace: true }); }}>
            <LogOut className="mr-1.5 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6"><Outlet /></main>
      <nav className="sticky bottom-0 border-t border-border bg-card">
        <div className="mx-auto grid max-w-5xl grid-cols-3">
          <NavTab to={isDriver ? "/driver" : "/passenger"} active={path.startsWith("/passenger") || path.startsWith("/driver") || path === "/home"} icon={<Car className="h-5 w-5" />} label={isDriver ? "Drive" : "Ride"} />
          <NavTab to="/wallet" active={path.startsWith("/wallet")} icon={<Wallet className="h-5 w-5" />} label="Wallet" />
          <NavTab to="/profile" active={path.startsWith("/profile") || path.startsWith("/become-driver")} icon={<UserIcon className="h-5 w-5" />} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function NavTab({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className={`flex flex-col items-center gap-1 py-3 text-xs transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
      {icon}<span>{label}</span>
    </Link>
  );
}
