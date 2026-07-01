import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

const SUPPORT_EMAIL = "nurmiko22@gmail.com";

export const Route = createFileRoute("/_authenticated/settings/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Политика конфиденциальности</h1>
      <Card className="space-y-3 p-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">1. Какие данные мы собираем.</strong> Имя, телефон,
          email, геолокацию, данные о поездках и платежах — только то, что необходимо для работы
          сервиса.
        </p>
        <p>
          <strong className="text-foreground">2. Как используются данные.</strong> Для подбора
          водителей, расчёта стоимости, поддержки и улучшения сервиса. Мы не продаём данные третьим
          лицам.
        </p>
        <p>
          <strong className="text-foreground">3. Передача данных.</strong> Водителю передаются ваше
          имя, рейтинг и точки маршрута. Платёжным провайдерам — данные, необходимые для оплаты.
        </p>
        <p>
          <strong className="text-foreground">4. Хранение.</strong> Данные хранятся в зашифрованном
          виде. Срок хранения — пока действует ваш аккаунт, либо как требует закон.
        </p>
        <p>
          <strong className="text-foreground">5. Ваши права.</strong> Вы можете запросить копию
          данных или удаление аккаунта, написав на {SUPPORT_EMAIL}.
        </p>
        <p>
          <strong className="text-foreground">6. Контакты.</strong> {SUPPORT_EMAIL}
        </p>
        <p className="text-xs">Последнее обновление: 30.06.2026</p>
      </Card>
    </div>
  );
}
