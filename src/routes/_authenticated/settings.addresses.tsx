import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressPicker, type PickedPoint } from "@/components/AddressPicker";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type SavedAddress = Database["public"]["Tables"]["saved_addresses"]["Row"];

export const Route = createFileRoute("/_authenticated/settings/addresses")({
  component: AddressesPage,
});

function AddressesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedAddress[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [point, setPoint] = useState<PickedPoint | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!user) return;
    const { data, error } = await supabase
      .from("saved_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setItems(data ?? []);
  }

  useEffect(() => { void load(); }, [user?.id]);

  async function save() {
    if (!user || !point || !label.trim()) {
      toast.error("Укажите название и адрес");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("saved_addresses").insert({
      user_id: user.id,
      label: label.trim(),
      address: point.address,
      lat: point.lat,
      lng: point.lng,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Адрес сохранён");
    setLabel(""); setPoint(null); setAdding(false);
    void load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("saved_addresses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Удалено");
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Сохранённые адреса</h1>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" /> Добавить
          </Button>
        )}
      </div>

      {adding && (
        <Card className="space-y-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="label">Название</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Например, Дом или Работа"
              maxLength={40}
            />
          </div>
          <AddressPicker label="Адрес" onChange={setPoint} initialPoint={point} showMyLocation />
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Сохранить
            </Button>
            <Button variant="outline" onClick={() => { setAdding(false); setLabel(""); setPoint(null); }}>
              Отмена
            </Button>
          </div>
        </Card>
      )}

      {items === null ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          У вас пока нет сохранённых адресов. Добавьте дом, работу и другие частые места — заказывать поездки станет быстрее.
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <Card key={a.id} className="flex items-center gap-3 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{a.label}</div>
                <div className="truncate text-xs text-muted-foreground">{a.address}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void remove(a.id)} aria-label="Удалить">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
