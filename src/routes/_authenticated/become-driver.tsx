import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { compareFaces } from "@/lib/verification.functions";
import { CameraCapture } from "@/components/CameraCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/become-driver")({
  component: BecomeDriver,
});

const txt = (max = 60) => z.string().trim().min(1, "Обязательное поле").max(max);

type Step = "vehicle" | "selfie" | "license" | "vehicle_doc" | "submitting" | "done";

function BecomeDriver() {
  const { user, hasDriverApplication, driverVerification, refreshDriver } = useAuth();
  const navigate = useNavigate();
  const compare = useServerFn(compareFaces);

  const [hasIdentity, setHasIdentity] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("vehicle");
  const [vehicle, setVehicle] = useState({ vehicle_make: "", vehicle_model: "", vehicle_plate: "", vehicle_color: "", license_number: "" });
  const [selfie, setSelfie] = useState<string | null>(null);
  const [license, setLicense] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.from("profiles").select("iin,verification_status").eq("id", user.id).maybeSingle()
      .then(({ data }) => setHasIdentity(Boolean(data?.iin)));
  }, [user]);

  function submitVehicle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const payload = {
        vehicle_make: txt().parse(fd.get("vehicle_make")),
        vehicle_model: txt().parse(fd.get("vehicle_model")),
        vehicle_plate: txt(15).parse(fd.get("vehicle_plate")),
        vehicle_color: txt(30).parse(fd.get("vehicle_color")),
        license_number: txt(30).parse(fd.get("license_number")),
      };
      setVehicle(payload);
      setStep("selfie");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Заполните все поля");
    }
  }

  async function uploadDataUrl(dataUrl: string, name: string): Promise<string> {
    if (!user) throw new Error("Нет сессии");
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${user.id}/${name}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("verification").upload(path, blob, {
      contentType: "image/jpeg", upsert: true,
    });
    if (error) throw error;
    return path;
  }

  async function finishWithVehicleDoc(vehicleDocUrl: string | null) {
    if (!user || !selfie || !license) return;
    setStep("submitting");
    setBusy(true);
    try {
      // Persist driver role + vehicle info first
      const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" });
      if (roleErr && !/duplicate/i.test(roleErr.message)) throw roleErr;
      const { error: drvErr } = await supabase.from("drivers").upsert({ id: user.id, ...vehicle, status: "offline" });
      if (drvErr) throw drvErr;

      // AI compare selfie vs license photo
      const result = await compare({
        data: { selfie, reference: license, context: "driver_license" },
      });

      const [selfiePath, licensePath, vehicleDocPath] = await Promise.all([
        uploadDataUrl(selfie, "driver-selfie"),
        uploadDataUrl(license, "driver-license"),
        vehicleDocUrl ? uploadDataUrl(vehicleDocUrl, "vehicle-doc") : Promise.resolve(null),
      ]);

      const { error } = await supabase.rpc("submit_driver_verification", {
        _selfie_path: selfiePath,
        _license_path: licensePath,
        _vehicle_doc_path: vehicleDocPath ?? "",
        _ai_confidence: result.confidence,
        _ai_reason: result.reason ?? "",
      });
      if (error) throw error;
      await refreshDriver();
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить");
      setStep("vehicle_doc");
    } finally {
      setBusy(false);
    }
  }

  if (hasIdentity === null) {
    return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!hasIdentity) {
    return (
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <h1 className="text-lg font-semibold">Сначала подтвердите личность</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Чтобы стать водителем, пройдите верификацию пассажира (ИИН + живое селфи).
            </p>
            <Button asChild className="mt-4"><Link to="/verify-identity">Пройти верификацию</Link></Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <h1 className="text-xl font-semibold">Заявка водителя</h1>
      <p className="mt-1 text-sm text-muted-foreground">Авто, живое селфи и фото ВУ. Проверит администратор.</p>

      {step === "vehicle" && (
        <form onSubmit={submitVehicle} className="mt-5 space-y-4">
          <Row label="Марка" name="vehicle_make" placeholder="Toyota" defaultValue={vehicle.vehicle_make} />
          <Row label="Модель" name="vehicle_model" placeholder="Camry" defaultValue={vehicle.vehicle_model} />
          <Row label="Госномер" name="vehicle_plate" placeholder="A 123 BC" defaultValue={vehicle.vehicle_plate} />
          <Row label="Цвет" name="vehicle_color" placeholder="Белый" defaultValue={vehicle.vehicle_color} />
          <Row label="Номер ВУ" name="license_number" placeholder="DL-99887766" defaultValue={vehicle.license_number} />
          <Button type="submit" className="w-full">Далее: селфи</Button>
        </form>
      )}

      {step === "selfie" && (
        <div className="mt-5">
          <CameraCapture
            label="Шаг 1 — живое селфи"
            facing="user"
            onCapture={(d) => { setSelfie(d); setStep("license"); }}
          />
        </div>
      )}

      {step === "license" && (
        <div className="mt-5">
          <CameraCapture
            label="Шаг 2 — сфотографируйте водительское удостоверение (лицевая сторона)"
            facing="environment"
            onCapture={(d) => { setLicense(d); setStep("vehicle_doc"); }}
          />
        </div>
      )}

      {step === "vehicle_doc" && (
        <div className="mt-5 space-y-3">
          <CameraCapture
            label="Шаг 3 — фото техпаспорта автомобиля"
            facing="environment"
            onCapture={(d) => void finishWithVehicleDoc(d)}
            busy={busy}
          />
          <Button variant="ghost" className="w-full" onClick={() => void finishWithVehicleDoc(null)} disabled={busy}>
            Пропустить (добавить позже)
          </Button>
        </div>
      )}

      {step === "submitting" && (
        <div className="mt-8 grid place-items-center gap-3 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Сверяем и отправляем на проверку…</p>
        </div>
      )}

      {step === "done" && (
        <div className="mt-6 space-y-3 text-center">
          <Badge>Заявка на проверке</Badge>
          <p className="text-sm text-muted-foreground">
            Администратор рассмотрит заявку в ближайшее время. Активация — после одобрения.
          </p>
          <Button className="w-full" onClick={() => void navigate({ to: "/profile" })}>В профиль</Button>
        </div>
      )}

      {step !== "vehicle" && step !== "submitting" && step !== "done" && (
        <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => setStep("vehicle")}>
          Отмена
        </Button>
      )}
    </Card>
  );
}

function Row({ label, name, placeholder, defaultValue }: { label: string; name: string; placeholder?: string; defaultValue?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} placeholder={placeholder} defaultValue={defaultValue} required />
    </div>
  );
}
