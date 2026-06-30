import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Условия использования</h1>
      <Card className="space-y-3 p-4 text-sm leading-relaxed text-muted-foreground">
        <p><strong className="text-foreground">1. Сервис.</strong> Senim — платформа, соединяющая пассажиров и водителей. Senim не является перевозчиком.</p>
        <p><strong className="text-foreground">2. Аккаунт.</strong> Пользователь обязан указывать достоверные данные и не передавать аккаунт третьим лицам.</p>
        <p><strong className="text-foreground">3. Оплата.</strong> Стоимость поездки рассчитывается автоматически. Оплата производится через кошелёк или наличными.</p>
        <p><strong className="text-foreground">4. Поведение.</strong> Запрещены оскорбления, мошенничество и нарушение ПДД. Нарушение влечёт блокировку.</p>
        <p><strong className="text-foreground">5. Отмена.</strong> Бесплатная отмена возможна до прибытия водителя.</p>
        <p><strong className="text-foreground">6. Ответственность.</strong> Senim не несёт ответственности за действия пользователей, но содействует в разрешении споров.</p>
        <p><strong className="text-foreground">7. Изменения.</strong> Условия могут обновляться. Уведомления отправляются в приложении.</p>
        <p className="text-xs">Последнее обновление: 30.06.2026</p>
      </Card>
    </div>
  );
}
