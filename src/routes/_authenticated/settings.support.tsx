import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Phone } from "lucide-react";

const SUPPORT_PHONE_PRIMARY = "+7 771 692 72 16";
const SUPPORT_PHONE_SECONDARY = "+7 775 433 05 47";
const SUPPORT_EMAIL = "nurmiko22@gmail.com";
const SUPPORT_WHATSAPP = "https://wa.me/77716927216";

export const Route = createFileRoute("/_authenticated/settings/support")({
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Техподдержка</h1>
      <p className="text-sm text-muted-foreground">Мы на связи 24/7. Выберите удобный способ:</p>
      <Card className="divide-y">
        <a
          href="tel:+77716927216"
          className="flex items-center gap-3 px-4 py-3 hover:bg-accent"
        >
          <Phone className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-medium">Позвонить: основная линия</div>
            <div className="text-xs text-muted-foreground">{SUPPORT_PHONE_PRIMARY}</div>
          </div>
        </a>
        <a
          href="tel:+77754330547"
          className="flex items-center gap-3 px-4 py-3 hover:bg-accent"
        >
          <Phone className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-medium">Позвонить: резервная линия</div>
            <div className="text-xs text-muted-foreground">{SUPPORT_PHONE_SECONDARY}</div>
          </div>
        </a>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-accent"
        >
          <Mail className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-medium">Электронная почта</div>
            <div className="text-xs text-muted-foreground">{SUPPORT_EMAIL}</div>
          </div>
        </a>
        <a
          href={SUPPORT_WHATSAPP}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-4 py-3 hover:bg-accent"
        >
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
        <a href={`mailto:${SUPPORT_EMAIL}?subject=Senim%20—%20Обращение`}>Написать письмо</a>
      </Button>
    </div>
  );
}
