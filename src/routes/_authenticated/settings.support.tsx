import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Phone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/support")({
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Техподдержка</h1>
      <p className="text-sm text-muted-foreground">Мы на связи 24/7. Выберите удобный способ:</p>
      <Card className="divide-y">
        <a href="tel:+77000000000" className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
          <Phone className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-medium">Позвонить</div>
            <div className="text-xs text-muted-foreground">+7 700 000 00 00</div>
          </div>
        </a>
        <a href="mailto:support@senim.app" className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
          <Mail className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-medium">Электронная почта</div>
            <div className="text-xs text-muted-foreground">support@senim.app</div>
          </div>
        </a>
        <a href="https://wa.me/77000000000" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
          <MessageCircle className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-medium">WhatsApp</div>
            <div className="text-xs text-muted-foreground">Чат с оператором</div>
          </div>
        </a>
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Часто задаваемые вопросы</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Как отменить заказ? — Нажмите «Отменить» на экране ожидания водителя.</li>
          <li>• Как пополнить кошелёк? — Раздел «Кошелёк» → «Пополнить».</li>
          <li>• Как стать водителем? — Профиль → «Стать водителем».</li>
        </ul>
      </Card>
      <Button variant="outline" className="w-full" asChild>
        <a href="mailto:support@senim.app?subject=Senim%20—%20Обращение">Написать письмо</a>
      </Button>
    </div>
  );
}
