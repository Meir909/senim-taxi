import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronRight, LifeBuoy, Shield, FileText, Info, MapPin, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isRoot = path === "/settings" || path === "/settings/";
  if (!isRoot) {
    return (
      <div className="space-y-4">
        <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Настройки
        </Link>
        <Outlet />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Настройки</h1>
      <Card className="divide-y overflow-hidden">
        <SettingsItem to="/settings/addresses" icon={<MapPin className="h-5 w-5 text-primary" />} title="Сохранённые адреса" subtitle="Дом, работа и другие места" />
        <SettingsItem to="/settings/support" icon={<LifeBuoy className="h-5 w-5 text-primary" />} title="Техподдержка" subtitle="Связаться с нами" />
        <SettingsItem to="/settings/privacy" icon={<Shield className="h-5 w-5 text-primary" />} title="Политика конфиденциальности" />
        <SettingsItem to="/settings/terms" icon={<FileText className="h-5 w-5 text-primary" />} title="Условия использования" />
        <SettingsItem to="/settings/about" icon={<Info className="h-5 w-5 text-primary" />} title="О приложении" subtitle="Партнёры и информация" />
      </Card>
    </div>
  );
}

function SettingsItem({ to, icon, title, subtitle }: { to: string; icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
