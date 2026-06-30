import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Star, Car, MapPin, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Driver = Database["public"]["Tables"]["drivers"]["Row"];

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isDriver, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [rideCount, setRideCount] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: d }, { count }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        isDriver
          ? supabase.from("drivers").select("*").eq("id", user.id).maybeSingle()
          : Promise.resolve({ data: null as Driver | null }),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq(isDriver ? "driver_id" : "passenger_id", user.id)
          .eq("status", "completed"),
      ]);
      setProfile(p);
      setDriver(d);
      setRideCount(count ?? 0);
    })();
  }, [user, isDriver]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const full_name = String(fd.get("full_name") ?? "").trim().slice(0, 100);
    const phone = String(fd.get("phone") ?? "").trim().slice(0, 20);
    try {
      setBusy(true);
      const { error } = await supabase.from("profiles").update({ full_name, phone }).eq("id", user.id);
      if (error) throw error;
      toast.success("Сохранено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  if (!profile) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initial = (profile.full_name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{profile.full_name || "Без имени"}</div>
            <div className="truncate text-sm text-muted-foreground">{user?.email}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant={isDriver ? "default" : "secondary"}>{isDriver ? "Водитель" : "Пассажир"}</Badge>
              {isDriver && driver?.verification && (
                <Badge variant="outline">
                  {driver.verification === "approved" ? "Подтверждён" : driver.verification === "pending" ? "На проверке" : "Отклонён"}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatBox icon={<MapPin className="h-4 w-4" />} label="Поездок" value={String(rideCount)} />
          {isDriver ? (
            <StatBox icon={<Star className="h-4 w-4 fill-warning text-warning" />} label="Рейтинг" value={Number(driver?.rating ?? 5).toFixed(2)} />
          ) : (
            <StatBox icon={<Car className="h-4 w-4" />} label="Статус" value="Активен" />
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Личные данные</h2>
        <form onSubmit={save} className="mt-4 space-y-3">
          <div className="space-y-1"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div className="space-y-1"><Label htmlFor="full_name">Полное имя</Label><Input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} maxLength={100} /></div>
          <div className="space-y-1"><Label htmlFor="phone">Телефон</Label><Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={profile.phone ?? ""} maxLength={20} placeholder="+7 ___ ___ __ __" /></div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Сохранить
          </Button>
        </form>
      </Card>

      {isDriver && driver && (
        <Card className="p-5">
          <h2 className="font-semibold">Автомобиль</h2>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Марка / модель" value={[driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(" ") || "—"} />
            <Row label="Цвет" value={driver.vehicle_color || "—"} />
            <Row label="Номер" value={driver.vehicle_plate || "—"} />
          </div>
        </Card>
      )}

      {!isDriver && (
        <Card className="p-5">
          <h2 className="font-semibold">Хотите водить?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Добавьте данные авто и начните зарабатывать.</p>
          <Button asChild className="mt-3 w-full"><Link to="/become-driver">Стать водителем</Link></Button>
        </Card>
      )}

      <Button variant="outline" className="w-full" onClick={() => void signOut()}>
        Выйти из аккаунта
      </Button>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
