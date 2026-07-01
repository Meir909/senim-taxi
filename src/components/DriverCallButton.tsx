import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizePhone } from "@/lib/phone";

export function DriverCallButton({
  phone,
  fullWidth = true,
}: {
  phone: string;
  fullWidth?: boolean;
}) {
  const href = `tel:${normalizePhone(phone)}`;

  return (
    <Button asChild variant="outline" className={fullWidth ? "w-full" : undefined}>
      <a href={href} rel="noopener noreferrer" aria-label={`Позвонить водителю по номеру ${phone}`}>
        <Phone className="mr-2 h-4 w-4 shrink-0" />
        Позвонить водителю
      </a>
    </Button>
  );
}
