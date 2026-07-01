import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Car, Wallet, User as UserIcon, LogOut, Loader2, Bell, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeNotifications } from "@/lib/notifications";
<<<<<<< HEAD

const APP_LOGO_SRC = "/icon-512.png";
=======
import logoAsset from "@/assets/logo.png.asset.json";
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, isDriver, isBlocked, blockedReason, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { permission, requestPermission } = useRealtimeNotifications();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && isBlocked) {
      void (async () => {
        await signOut();
        const reason = encodeURIComponent(blockedReason ?? "Аккаунт заблокирован администратором");
        void navigate({ to: "/auth", search: { blocked: reason } as never, replace: true });
      })();
    }
  }, [loading, user, isBlocked, blockedReason, navigate, signOut]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
<<<<<<< HEAD
      <header
        className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/home" className="flex min-w-0 items-center gap-2">
            <img
              src={APP_LOGO_SRC}
              alt="Senim"
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
=======
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/home" className="flex min-w-0 items-center gap-2">
            <img src={logoAsset.url} alt="Senim" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
            <span className="truncate font-semibold">Senim</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {permission !== "granted" && (
<<<<<<< HEAD
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void requestPermission()}
                aria-label="Включить уведомления"
              >
                <Bell className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/auth", replace: true });
              }}
            >
=======
              <Button variant="ghost" size="icon" onClick={() => void requestPermission()} aria-label="Включить уведомления">
                <Bell className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); void navigate({ to: "/auth", replace: true }); }}>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
              <LogOut className="mr-1.5 h-4 w-4" /> Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-24 sm:py-6">
        <Outlet />
      </main>
<<<<<<< HEAD
      <nav
        className="sticky bottom-0 z-10 border-t border-border bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-4">
          <NavTab
            to={isDriver ? "/driver" : "/passenger"}
            active={path.startsWith("/passenger") || path.startsWith("/driver") || path === "/home"}
            icon={<Car className="h-5 w-5" />}
            label={isDriver ? "Поездки" : "Заказать"}
          />
          <NavTab
            to="/history"
            active={path.startsWith("/history")}
            icon={<Clock className="h-5 w-5" />}
            label="История"
          />
          <NavTab
            to="/wallet"
            active={path.startsWith("/wallet")}
            icon={<Wallet className="h-5 w-5" />}
            label="Кошелёк"
          />
          <NavTab
            to="/profile"
            active={path.startsWith("/profile") || path.startsWith("/become-driver")}
            icon={<UserIcon className="h-5 w-5" />}
            label="Профиль"
          />
=======
      <nav className="sticky bottom-0 z-10 border-t border-border bg-card" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid max-w-5xl grid-cols-4">
          <NavTab to={isDriver ? "/driver" : "/passenger"} active={path.startsWith("/passenger") || path.startsWith("/driver") || path === "/home"} icon={<Car className="h-5 w-5" />} label={isDriver ? "Поездки" : "Заказать"} />
          <NavTab to="/history" active={path.startsWith("/history")} icon={<Clock className="h-5 w-5" />} label="История" />
          <NavTab to="/wallet" active={path.startsWith("/wallet")} icon={<Wallet className="h-5 w-5" />} label="Кошелёк" />
          <NavTab to="/profile" active={path.startsWith("/profile") || path.startsWith("/become-driver")} icon={<UserIcon className="h-5 w-5" />} label="Профиль" />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        </div>
      </nav>
    </div>
  );
}

<<<<<<< HEAD
function NavTab({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
      <span>{label}</span>
=======
function NavTab({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
      {icon}<span>{label}</span>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    </Link>
  );
}
