import { useMemo, useState } from "react";
import { Baby, CalendarDays, IdCard, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatChildMeta, formatMaskedIin, type PassengerChild } from "@/lib/passenger-children";
import { parseIin } from "@/lib/iin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  motherId: string;
  eligible: boolean;
  children: PassengerChild[];
  loading?: boolean;
  onSaved: () => void | Promise<void>;
};

export function PassengerChildrenCard({ motherId, eligible, children, loading, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const limitReached = children.length >= 5;
  const sortedChildren = useMemo(
    () => [...children].sort((a, b) => a.birth_date.localeCompare(b.birth_date)),
    [children],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    const iin = String(form.get("iin") ?? "")
      .replace(/\D/g, "")
      .slice(0, 12);

    if (!fullName || fullName.length < 2) {
      toast.error("Укажите ФИО ребёнка");
      return;
    }
    if (!/^\d{12}$/.test(iin)) {
      toast.error("Укажите ИИН ребёнка из 12 цифр");
      return;
    }
    if (!parseIin(iin)) {
      toast.error("ИИН ребёнка не прошёл проверку");
      return;
    }
    if (limitReached) {
      toast.error("Можно добавить максимум 5 детей");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("passenger_children").insert({
      mother_id: motherId,
      full_name: fullName,
      iin,
      birth_date: new Date().toISOString().slice(0, 10),
    });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Ребёнок добавлен");
    setOpen(false);
    await onSaved();
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Дети пассажирки</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Взрослая пассажирка может добавить до 5 детей по ФИО и ИИН и использовать детский тариф.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={!eligible || !!loading || limitReached}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Добавить
        </Button>
      </div>

      {!eligible ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Добавление детей доступно только совершеннолетним женщинам-пассажиркам.
        </div>
      ) : loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Загружаем список детей…
        </div>
      ) : sortedChildren.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Пока нет добавленных детей. После добавления можно будет оформлять детский тариф.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {sortedChildren.map((child) => (
            <div key={child.id} className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Baby className="h-4 w-4 text-primary" />
                {child.full_name}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatChildMeta(child)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IdCard className="h-3.5 w-3.5" />
                  ИИН: {formatMaskedIin(child.iin)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Доступен для детского тарифа
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && sortedChildren.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Добавлено {children.length} из 5 детей.
          {limitReached && " Лимит достигнут."}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить ребёнка</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-1">
              <Label htmlFor="child_full_name">ФИО ребёнка</Label>
              <Input
                id="child_full_name"
                name="full_name"
                maxLength={120}
                placeholder="Например, Айару Серик"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="child_iin">ИИН ребёнка</Label>
              <Input
                id="child_iin"
                name="iin"
                inputMode="numeric"
                maxLength={12}
                placeholder="12 цифр"
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Ребёнка можно добавить только один раз. Максимум разрешено 5 детей. Возраст ребёнка
              система определит по ИИН.
            </div>
            <Button type="submit" className="w-full" disabled={busy || limitReached}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить ребёнка
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
