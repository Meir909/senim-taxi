import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { compareFaces } from "@/lib/verification.functions";
import { parseIin } from "@/lib/iin";
import { CameraCapture } from "@/components/CameraCapture";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/verify-identity")({
  component: VerifyIdentity,
});

const Schema = z.object({
  full_name: z.string().trim().min(2, "Минимум 2 символа").max(100),
  iin: z.string().regex(/^\d{12}$/, "ИИН — 12 цифр"),
});

type Step = "form" | "selfie1" | "selfie2" | "submitting" | "done";

function VerifyIdentity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const compare = useServerFn(compareFaces);
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [iin, setIin] = useState("");
  const [selfie1, setSelfie1] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const v = Schema.parse({ full_name: fullName, iin });
      const parsed = parseIin(v.iin);
      if (!parsed) throw new Error("ИИН не прошёл проверку контрольной суммы");
      setStep("selfie1");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Проверьте данные");
    }
  }

  async function uploadDataUrl(dataUrl: string, name: string): Promise<string> {
    if (!user) throw new Error("Нет сессии");
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${user.id}/${name}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("verification").upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    return path;
  }

  async function onSelfie2(dataUrl: string) {
    if (!selfie1) return;
    setStep("submitting");
    setBusy(true);
    try {
      const parsed = parseIin(iin)!;
      const result = await compare({
        data: { selfie: dataUrl, reference: selfie1, context: "passenger_selfie_only" },
      });
      const confidence = result.liveness_ok ? result.confidence : Math.min(result.confidence, 0.5);

      const path = await uploadDataUrl(dataUrl, "selfie");
      // also keep the first capture for audit
      await uploadDataUrl(selfie1, "selfie-ref");

      const { data, error } = await supabase.rpc("submit_passenger_verification", {
        _full_name: fullName.trim(),
        _iin: iin,
        _dob: parsed.dob,
        _gender: parsed.gender,
        _selfie_path: path,
        _ai_confidence: confidence,
        _ai_reason: result.reason ?? "",
      });
      if (error) throw error;
      setResultStatus(data?.status ?? "manual_review");
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось завершить верификацию");
      setStep("selfie2");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/profile" })} className="-ml-2">
        <ArrowLeft className="mr-1 h-4 w-4" /> К профилю
      </Button>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Подтверждение личности</h1>
            <p className="text-xs text-muted-foreground">ИИН + живое селфи. Только живая камера.</p>
          </div>
        </div>

        {step === "form" && (
          <form onSubmit={submitForm} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">ФИО как в документе</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iin">ИИН (12 цифр)</Label>
              <Input
                id="iin" value={iin} onChange={(e) => setIin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                inputMode="numeric" pattern="\d{12}" required
              />
              {iin.length === 12 && (
                <p className="text-xs text-muted-foreground">
                  {parseIin(iin)
                    ? `ИИН валиден · дата рождения ${parseIin(iin)!.dob}, пол ${parseIin(iin)!.gender === "male" ? "мужской" : "женский"}`
                    : "Контрольная сумма не сходится"}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full">Далее</Button>
          </form>
        )}

        {step === "selfie1" && (
          <div className="mt-5">
            <CameraCapture
              label="Шаг 1 из 2 — посмотрите прямо в камеру"
              facing="user"
              onCapture={(d) => { setSelfie1(d); setStep("selfie2"); }}
            />
          </div>
        )}

        {step === "selfie2" && (
          <div className="mt-5">
            <CameraCapture
              label="Шаг 2 из 2 — слегка поверните голову"
              facing="user"
              onCapture={onSelfie2}
              busy={busy}
            />
          </div>
        )}

        {step === "submitting" && (
          <div className="mt-8 grid place-items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Сверяем фото и сохраняем…</p>
          </div>
        )}

        {step === "done" && (
          <div className="mt-6 space-y-3 text-center">
            <Badge variant={resultStatus === "auto_approved" ? "default" : "secondary"}>
              {resultStatus === "auto_approved" ? "Подтверждено автоматически" : "Отправлено на ручную проверку"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {resultStatus === "auto_approved"
                ? "Личность подтверждена. Можно пользоваться сервисом."
                : "Администратор проверит заявку и пришлёт уведомление. Полная активация — после одобрения."}
            </p>
            <Button className="w-full" onClick={() => void navigate({ to: "/home" })}>
              На главную
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
