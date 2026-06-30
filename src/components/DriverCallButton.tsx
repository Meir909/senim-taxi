import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

function cleanPhone(phone: string): string {
  // Keep only digits and leading +; iOS/Android dial best with no spaces.
  return phone.replace(/[^\d+]/g, "");
}

export function DriverCallButton({
  phone,
  fullWidth = true,
}: {
  phone: string;
  fullWidth?: boolean;
}) {
  const href = `tel:${cleanPhone(phone)}`;

  return (
    <Button asChild variant="outline" className={fullWidth ? "w-full" : undefined}>
      <a
        href={href}
        rel="noopener noreferrer"
        aria-label={`Позвонить водителю по номеру ${phone}`}
      >
        <Phone className="mr-2 h-4 w-4 shrink-0" />
        Позвонить водителю
      </a>
    </Button>
  );
}
