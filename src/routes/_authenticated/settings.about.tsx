import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
<<<<<<< HEAD

const APP_LOGO_SRC = "/icon-512.png";
=======
import logoAsset from "@/assets/logo.png.asset.json";
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231

export const Route = createFileRoute("/_authenticated/settings/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">О приложении</h1>
      <Card className="flex items-center gap-3 p-4">
<<<<<<< HEAD
        <img src={APP_LOGO_SRC} alt="Senim" className="h-14 w-14 rounded-xl object-cover" />
=======
        <img src={logoAsset.url} alt="Senim" className="h-14 w-14 rounded-xl object-cover" />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        <div>
          <div className="font-semibold">Senim</div>
          <div className="text-xs text-muted-foreground">Версия 1.0.0</div>
        </div>
      </Card>
      <Card className="space-y-2 p-4 text-sm text-muted-foreground">
<<<<<<< HEAD
        <p>
          Senim — современный сервис заказа поездок. Мы соединяем пассажиров и водителей, делая
          поездки быстрыми, безопасными и доступными.
        </p>
=======
        <p>Senim — современный сервис заказа поездок. Мы соединяем пассажиров и водителей, делая поездки быстрыми, безопасными и доступными.</p>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        <p>© 2026 Senim. Все права защищены.</p>
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Партнёры</h2>
<<<<<<< HEAD
        <p className="text-sm text-muted-foreground">
          Пока что у нас нет партнёров. Здесь скоро появится список наших партнёров и брендов.
        </p>
=======
        <p className="text-sm text-muted-foreground">Пока что у нас нет партнёров. Здесь скоро появится список наших партнёров и брендов.</p>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      </Card>
    </div>
  );
}
