import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ShieldAlert, PhoneCall, Shield, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrustedContacts } from "@/hooks/useTrustedContacts";
import { callPhoneNumber } from "@/lib/trusted-contacts";
import { cn } from "@/lib/utils";

const HOLD_MS = 3000;

function callWithNotice(phone: string, label: string) {
  toast.info(`Звоним: ${label}`);
  callPhoneNumber(phone);
}

export function SosButton() {
  const { primaryContact } = useTrustedContacts();
  const navigate = useNavigate();
  const timeoutRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  function triggerSos() {
    if (!primaryContact) {
      toast.error("Сначала добавьте доверенный контакт в профиле");
      void navigate({ to: "/profile" });
      return;
    }
    toast.warning(
      "Если контакт не ответит, используйте 112. Для прямого вызова полиции доступен 102.",
    );
    callPhoneNumber(primaryContact.phone);
  }

  useEffect(() => {
    if (!holding) return;
    const intervalId = window.setInterval(() => {
      if (startedAtRef.current == null) return;
      const elapsed = Date.now() - startedAtRef.current;
      setProgress(Math.min(100, Math.round((elapsed / HOLD_MS) * 100)));
    }, 50);

    return () => window.clearInterval(intervalId);
  }, [holding]);

  function resetHold() {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    startedAtRef.current = null;
    setHolding(false);
    setProgress(0);
  }

  function startHold() {
    if (holding) return;
    if (!primaryContact) {
      toast.error("Сначала добавьте доверенный контакт в профиле");
      void navigate({ to: "/profile" });
      return;
    }

    startedAtRef.current = Date.now();
    setHolding(true);
    setProgress(0);
    timeoutRef.current = window.setTimeout(() => {
      resetHold();
      triggerSos();
    }, HOLD_MS);
  }

  useEffect(() => resetHold, []);

  const remainingSeconds = Math.max(
    0,
    (HOLD_MS - Math.min(HOLD_MS, Math.round((progress / 100) * HOLD_MS))) / 1000,
  );

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className="relative shrink-0 overflow-hidden"
      onMouseDown={startHold}
      onMouseUp={resetHold}
      onMouseLeave={resetHold}
      onTouchStart={startHold}
      onTouchEnd={resetHold}
      onTouchCancel={resetHold}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Нажмите и удерживайте 3 секунды для SOS"
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 bg-destructive-foreground/20 transition-[width]",
          holding ? "duration-75" : "duration-200",
        )}
        style={{ width: `${progress}%` }}
      />
      <span className="relative flex items-center">
        <ShieldAlert className="mr-1.5 h-4 w-4" />
        {holding ? `SOS ${remainingSeconds.toFixed(1)}с` : "SOS"}
      </span>
    </Button>
  );
}

export function TripSafetyCard() {
  const { primaryContact } = useTrustedContacts();

  return (
    <Card className="border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-destructive">Экстренная помощь</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Для общей экстренной помощи лучше использовать 112. Если нужна именно полиция, можно
            звонить 102.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Для SOS удерживайте кнопку 3 секунды.
          </p>
        </div>
        <SosButton />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          className="justify-start"
          onClick={() =>
            primaryContact
              ? callWithNotice(primaryContact.phone, primaryContact.name)
              : toast.error("Нет основного доверенного контакта")
          }
        >
          <UserRound className="mr-2 h-4 w-4" />
          {primaryContact ? primaryContact.name : "Нет контакта"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="justify-start"
          onClick={() => callWithNotice("112", "112")}
        >
          <PhoneCall className="mr-2 h-4 w-4" />
          Позвонить 112
        </Button>
        <Button
          type="button"
          variant="outline"
          className="justify-start"
          onClick={() => callWithNotice("102", "102")}
        >
          <Shield className="mr-2 h-4 w-4" />
          Позвонить 102
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        В веб-приложении нельзя определить, ответил ли контакт на звонок, поэтому автоматический
        переход на 112/102 после сброса здесь технически недоступен.
      </p>
    </Card>
  );
}
