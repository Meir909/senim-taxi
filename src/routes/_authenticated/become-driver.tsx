import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/become-driver")({
  component: BecomeDriver,
});

const txt = (max = 60) => z.string().trim().min(1, "Обязательное поле").max(max);

function BecomeDriver() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    try {
      const payload = {
        vehicle_make: txt().parse(fd.get("vehicle_make")),
        vehicle_model: txt().parse(fd.get("vehicle_model")),
        vehicle_plate: txt(15).parse(fd.get("vehicle_plate")),
        vehicle_color: txt(30).parse(fd.get("vehicle_color")),
        license_number: txt(30).parse(fd.get("license_number")),
      };
      setBusy(true);
      const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" });
      if (roleErr && !/duplicate/i.test(roleErr.message)) throw roleErr;
      const { error } = await supabase.from("drivers").upsert({
        id: user.id, ...payload, status: "offline",
      });
      if (error) throw error;
      toast.success("Заявка отправлена. Ожидайте подтверждения.");
      window.location.assign("/driver");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить");
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h1 className="text-xl font-semibold">Заявка водителя</h1>
      <p className="mt-1 text-sm text-muted-foreground">Укажите данные авто. В MVP подтверждение вручную.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Row label="Марка" name="vehicle_make" placeholder="Toyota" />
        <Row label="Модель" name="vehicle_model" placeholder="Camry" />
        <Row label="Госномер" name="vehicle_plate" placeholder="A 123 BC" />
        <Row label="Цвет" name="vehicle_color" placeholder="Белый" />
        <Row label="Номер ВУ" name="license_number" placeholder="DL-99887766" />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Отправить
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void navigate({ to: "/home" })}>Отмена</Button>
      </form>
    </Card>
  );
}

function Row({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} placeholder={placeholder} required />
    </div>
  );
}
