import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import logoAsset from "@/assets/logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/settings/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">О приложении</h1>
      <Card className="flex items-center gap-3 p-4">
        <img src={logoAsset.url} alt="Senim" className="h-14 w-14 rounded-xl object-cover" />
        <div>
          <div className="font-semibold">Senim</div>
          <div className="text-xs text-muted-foreground">Версия 1.0.0</div>
        </div>
      </Card>
      <Card className="space-y-2 p-4 text-sm text-muted-foreground">
        <p>Senim — современный сервис заказа поездок. Мы соединяем пассажиров и водителей, делая поездки быстрыми, безопасными и доступными.</p>
        <p>© 2026 Senim. Все права защищены.</p>
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Партнёры</h2>
        <p className="text-sm text-muted-foreground">Пока что у нас нет партнёров. Здесь скоро появится список наших партнёров и брендов.</p>
      </Card>
    </div>
  );
}
