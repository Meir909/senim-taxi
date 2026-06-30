import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
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

const ProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Минимум 2 символа").max(100),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^\+?[0-9 ()\-]{6,20}$/, "Некорректный номер телефона"),
});

const VehicleSchema = z.object({
  vehicle_make: z.string().trim().min(2, "Укажите марку").max(40),
  vehicle_model: z.string().trim().min(1, "Укажите модель").max(40),
  vehicle_color: z.string().trim().min(2, "Укажите цвет").max(30),
  vehicle_plate: z
    .string()
    .trim()
    .min(3, "Укажите номер")
    .max(15)
    .regex(/^[A-Za-zА-Яа-я0-9 \-]+$/, "Недопустимые символы"),
});

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isDriver, hasDriverApplication, driverVerification, roles, signOut } = useAuth();
  const isAdmin = roles.includes("admin");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [rideCount, setRideCount] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: d }, { count }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        hasDriverApplication
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
  }, [user, isDriver, hasDriverApplication]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    try {
      const v = ProfileSchema.parse({
        full_name: String(fd.get("full_name") ?? ""),
        phone: String(fd.get("phone") ?? ""),
      });
      setBusy(true);
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: v.full_name, phone: v.phone })
        .eq("id", user.id);
      if (error) throw error;
      setProfile((p) => (p ? { ...p, full_name: v.full_name, phone: v.phone } : p));
      toast.success("Профиль сохранён");
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.issues[0]?.message ?? "Проверьте данные");
      else toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
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

      <VerificationCard status={profile.verification_status} />

      {isAdmin && (
        <Card className="p-5">
          <h2 className="font-semibold">Администрирование</h2>
          <p className="mt-1 text-sm text-muted-foreground">Очередь заявок на верификацию.</p>
          <Button asChild className="mt-3 w-full" variant="outline">
            <Link to="/admin/verifications">Открыть админку</Link>
          </Button>
        </Card>
      )}


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
        <VehicleCard
          driver={driver}
          onSaved={(d) => setDriver(d)}
        />
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

function VehicleCard({ driver, onSaved }: { driver: Driver; onSaved: (d: Driver) => void }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const v = VehicleSchema.parse({
        vehicle_make: String(fd.get("vehicle_make") ?? ""),
        vehicle_model: String(fd.get("vehicle_model") ?? ""),
        vehicle_color: String(fd.get("vehicle_color") ?? ""),
        vehicle_plate: String(fd.get("vehicle_plate") ?? "").toUpperCase(),
      });
      setBusy(true);
      const { data, error } = await supabase
        .from("drivers")
        .update(v)
        .eq("id", driver.id)
        .select("*")
        .single();
      if (error) throw error;
      onSaved(data);
      setEditing(false);
      toast.success("Данные авто сохранены");
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.issues[0]?.message ?? "Проверьте данные");
      else toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Автомобиль</h2>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Изменить</Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="vehicle_make">Марка</Label>
              <Input id="vehicle_make" name="vehicle_make" defaultValue={driver.vehicle_make ?? ""} maxLength={40} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vehicle_model">Модель</Label>
              <Input id="vehicle_model" name="vehicle_model" defaultValue={driver.vehicle_model ?? ""} maxLength={40} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="vehicle_color">Цвет</Label>
            <Input id="vehicle_color" name="vehicle_color" defaultValue={driver.vehicle_color ?? ""} maxLength={30} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vehicle_plate">Гос. номер</Label>
            <Input
              id="vehicle_plate" name="vehicle_plate"
              defaultValue={driver.vehicle_plate ?? ""}
              maxLength={15} required
              className="uppercase"
              placeholder="123 ABC 02"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={busy}>
              Отмена
            </Button>
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Сохранить
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <Row label="Марка / модель" value={[driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(" ") || "—"} />
          <Row label="Цвет" value={driver.vehicle_color || "—"} />
          <Row label="Номер" value={driver.vehicle_plate || "—"} />
        </div>
      )}
    </Card>
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

function VerificationCard({ status }: { status: Profile["verification_status"] }) {
  const meta: Record<string, { icon: React.ReactNode; title: string; desc: string; cta: string | null; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { icon: <ShieldAlert className="h-5 w-5 text-warning" />, title: "Личность не подтверждена", desc: "Пройдите проверку: ИИН + живое селфи.", cta: "Пройти верификацию", variant: "secondary" },
    manual_review: { icon: <ShieldAlert className="h-5 w-5 text-warning" />, title: "На ручной проверке", desc: "Администратор рассмотрит заявку и пришлёт уведомление.", cta: null, variant: "secondary" },
    auto_approved: { icon: <ShieldCheck className="h-5 w-5 text-success" />, title: "Подтверждено автоматически", desc: "Личность успешно проверена.", cta: null, variant: "default" },
    approved: { icon: <ShieldCheck className="h-5 w-5 text-success" />, title: "Подтверждено администратором", desc: "Аккаунт активирован.", cta: null, variant: "default" },
    rejected: { icon: <ShieldX className="h-5 w-5 text-destructive" />, title: "Верификация отклонена", desc: "Проверьте данные и подайте заявку повторно.", cta: "Подать снова", variant: "destructive" },
    reupload_requested: { icon: <ShieldAlert className="h-5 w-5 text-warning" />, title: "Требуется повторная загрузка", desc: "Администратор запросил перезагрузку фото.", cta: "Перезагрузить", variant: "secondary" },
  };
  const m = meta[status] ?? meta.pending;
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        {m.icon}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Верификация</h2>
            <Badge variant={m.variant}>{m.title}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
          {m.cta && (
            <Button asChild className="mt-3 w-full" variant="outline">
              <Link to="/verify-identity">{m.cta}</Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

