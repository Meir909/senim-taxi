import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { compareFaces } from "@/lib/verification.functions";
<<<<<<< HEAD
import { canBeDriverByIin, canBePassengerByIin, getAgeFromDob, parseIin } from "@/lib/iin";
=======
import { parseIin } from "@/lib/iin";
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
import { CameraCapture } from "@/components/CameraCapture";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft, AlertTriangle } from "lucide-react";

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
  const [priorStatus, setPriorStatus] = useState<string | null>(null);
  const [priorReason, setPriorReason] = useState<string | null>(null);
  const [iinRejection, setIinRejection] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("verification_status")
        .eq("id", user.id)
        .maybeSingle();
      const status = profile?.verification_status ?? null;
      if (cancelled) return;
      if (status === "rejected" || status === "reupload_requested") {
        setPriorStatus(status);
        const { data: req } = await supabase
          .from("verification_requests")
          .select("reviewer_comment, ai_reason")
          .eq("user_id", user.id)
          .eq("kind", "passenger")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        setPriorReason(req?.reviewer_comment || req?.ai_reason || null);
      }
    })();
<<<<<<< HEAD
    return () => {
      cancelled = true;
    };
=======
    return () => { cancelled = true; };
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  }, [user]);

  function resetForRetry() {
    setIinRejection(null);
    setPriorStatus(null);
    setPriorReason(null);
    setSelfie1(null);
    setResultStatus(null);
    setStep("form");
  }

  function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIinRejection(null);
    setPriorStatus(null);
    try {
      const v = Schema.parse({ full_name: fullName, iin });
      const parsed = parseIin(v.iin);
      if (!parsed) {
        setIinRejection("ИИН не прошёл проверку контрольной суммы. Проверьте номер.");
        return;
      }
<<<<<<< HEAD
      if (!canBeDriverByIin(parsed) && !canBePassengerByIin(parsed)) {
        setIinRejection(
          "По ИИН это взрослый мужчина. Сервис допускает только детей младше 18 лет или женщин 18+.",
        );
=======
      if (parsed.gender !== "female") {
        setIinRejection("По ИИН пол — мужской. Сервис доступен только женщинам. Заявка отклонена.");
        return;
      }
      const dob = new Date(parsed.dob);
      const eighteen = new Date();
      eighteen.setFullYear(eighteen.getFullYear() - 18);
      if (dob > eighteen) {
        setIinRejection("По ИИН возраст меньше 18 лет. Сервис доступен только совершеннолетним. Заявка отклонена.");
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        return;
      }
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
<<<<<<< HEAD
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigate({ to: "/profile" })}
        className="-ml-2"
      >
=======
      <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/profile" })} className="-ml-2">
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        <ArrowLeft className="mr-1 h-4 w-4" /> К профилю
      </Button>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Подтверждение личности</h1>
<<<<<<< HEAD
            <p className="text-xs text-muted-foreground">
              ИИН + живое селфи. Дети младше 18 лет могут быть пассажирами, женщины 18+ могут
              пользоваться сервисом и подавать заявку в водители.
            </p>
=======
            <p className="text-xs text-muted-foreground">Сервис только для женщин 18+. ИИН + живое селфи.</p>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
          </div>
        </div>

        {priorStatus && step === "form" && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {priorStatus === "rejected" ? "Заявка отклонена" : "Требуется повторная отправка"}
            </AlertTitle>
            <AlertDescription className="space-y-2">
<<<<<<< HEAD
              <p>
                {priorReason ||
                  "Данные не прошли проверку. Сервис доступен детям младше 18 лет и женщинам 18+. Отправьте заявку повторно с корректными данными."}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIin("");
                  setFullName("");
                  resetForRetry();
                }}
=======
              <p>{priorReason || "Данные не прошли проверку. Сервис доступен только женщинам 18+. Отправьте заявку повторно с корректными данными."}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setIin(""); setFullName(""); resetForRetry(); }}
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
              >
                Очистить и начать заново
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {step === "form" && (
          <form onSubmit={submitForm} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">ФИО как в документе</Label>
<<<<<<< HEAD
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
                required
              />
=======
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} required />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iin">ИИН (12 цифр)</Label>
              <Input
<<<<<<< HEAD
                id="iin"
                value={iin}
                onChange={(e) => setIin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                inputMode="numeric"
                pattern="\d{12}"
                required
=======
                id="iin" value={iin} onChange={(e) => setIin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                inputMode="numeric" pattern="\d{12}" required
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
              />
              {iin.length === 12 && (
                <p className="text-xs text-muted-foreground">
                  {parseIin(iin)
<<<<<<< HEAD
                    ? `ИИН валиден · дата рождения ${parseIin(iin)!.dob}, возраст ${getAgeFromDob(parseIin(iin)!.dob)}, пол ${parseIin(iin)!.gender === "male" ? "мужской" : "женский"}`
=======
                    ? `ИИН валиден · дата рождения ${parseIin(iin)!.dob}, пол ${parseIin(iin)!.gender === "male" ? "мужской" : "женский"}`
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
                    : "Контрольная сумма не сходится"}
                </p>
              )}
            </div>
            {iinRejection && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Заявка отклонена</AlertTitle>
                <AlertDescription>{iinRejection}</AlertDescription>
              </Alert>
            )}
<<<<<<< HEAD
            <Button type="submit" className="w-full">
              {iinRejection ? "Отправить повторно" : "Далее"}
            </Button>
=======
            <Button type="submit" className="w-full">{iinRejection ? "Отправить повторно" : "Далее"}</Button>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
          </form>
        )}

        {step === "selfie1" && (
          <div className="mt-5">
            <CameraCapture
              label="Шаг 1 из 2 — посмотрите прямо в камеру"
              facing="user"
<<<<<<< HEAD
              onCapture={(d) => {
                setSelfie1(d);
                setStep("selfie2");
              }}
=======
              onCapture={(d) => { setSelfie1(d); setStep("selfie2"); }}
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
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
<<<<<<< HEAD
              {resultStatus === "auto_approved"
                ? "Подтверждено автоматически"
                : "Отправлено на ручную проверку"}
=======
              {resultStatus === "auto_approved" ? "Подтверждено автоматически" : "Отправлено на ручную проверку"}
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
            </Badge>
            <p className="text-sm text-muted-foreground">
              {resultStatus === "auto_approved"
                ? "Личность подтверждена. Можно пользоваться сервисом."
                : "Администратор проверит заявку и пришлёт уведомление. Полная активация — после одобрения."}
            </p>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => void navigate({ to: "/home" })}>
                На главную
              </Button>
              {resultStatus !== "auto_approved" && (
<<<<<<< HEAD
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIin("");
                    setFullName("");
                    resetForRetry();
                  }}
                >
=======
                <Button variant="outline" className="w-full" onClick={() => { setIin(""); setFullName(""); resetForRetry(); }}>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
                  Отправить повторно
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
