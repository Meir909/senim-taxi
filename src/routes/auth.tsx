import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { canBeDriverByIin, canBePassengerByIin, getAgeFromDob, parseIin } from "@/lib/iin";
import { compareFaces } from "@/lib/verification.functions";
import { CameraCapture } from "@/components/CameraCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Info, AlertTriangle, ShieldCheck } from "lucide-react";
const APP_LOGO_SRC = "/icon-512.png";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Вход — Senim" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Неверный email").max(255);
const passwordSchema = z.string().min(6, "Минимум 6 символов").max(72);
const nameSchema = z.string().trim().min(1, "Обязательное поле").max(60);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{7,20}$/, "Неверный телефон");

function formatKzPhone(input: string): string {
  // Keep only digits; auto-prepend "+" for KZ numbers (starting with 7 or 8→7).
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length === 0) return "";
  if (digits[0] !== "7") return "+" + digits;
  return "+" + digits.slice(0, 11);
}

type SignupStep = "form" | "selfie1" | "selfie2" | "submitting";

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const compare = useServerFn(compareFaces);
  const [busy, setBusy] = useState(false);
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [selfie1, setSelfie1] = useState<string | null>(null);
  const blockedNotice = useMemo(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search).get("blocked");
    return p ? decodeURIComponent(p) : null;
  }, []);

  useEffect(() => {
    if (!loading && user && signupStep === "form") void navigate({ to: "/home", replace: true });
  }, [user, loading, navigate, signupStep]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [phone, setPhone] = useState("");
  const [iin, setIin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const iinInfo = useMemo(() => (iin.length === 12 ? parseIin(iin) : null), [iin]);
  const genderRu = iinInfo ? (iinInfo.gender === "female" ? "Женский" : "Мужской") : "";
  const age = iinInfo ? getAgeFromDob(iinInfo.dob) : null;
  const canRegister = iinInfo ? canBeDriverByIin(iinInfo) || canBePassengerByIin(iinInfo) : false;

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const em = emailSchema.parse(fd.get("email"));
      const pw = passwordSchema.parse(fd.get("password"));
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (error) throw error;
      toast.success("С возвращением!");
      void navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const em = emailSchema.parse(email);
      const pw = passwordSchema.parse(password);
      const fn = nameSchema.parse(firstName);
      const ln = nameSchema.parse(lastName);
      const ph = phoneSchema.parse(phone);
      if (!/^\d{12}$/.test(iin)) throw new Error("ИИН — 12 цифр");
      const info = parseIin(iin);
      if (!info) throw new Error("ИИН не прошёл проверку контрольной суммы");
      if (!canBeDriverByIin(info) && !canBePassengerByIin(info)) {
        throw new Error("Регистрация доступна только детям младше 18 лет или женщинам 18+.");
      }

      setBusy(true);
      const fullName = [ln, fn, patronymic.trim()].filter(Boolean).join(" ");
      const { data, error } = await supabase.auth.signUp({
        email: em,
        password: pw,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
          data: {
            full_name: fullName,
            first_name: fn,
            last_name: ln,
            patronymic: patronymic.trim() || null,
            phone: ph,
            iin,
            date_of_birth: info.dob,
            gender: info.gender,
          },
        },
      });
      if (error) {
        if (/duplicate|already registered|23505|exists/i.test(error.message)) {
          throw new Error("Email, ИИН или телефон уже зарегистрированы");
        }
        throw error;
      }
      let uid = data.user?.id ?? null;
      if (!data.session) {
        const signIn = await supabase.auth.signInWithPassword({ email: em, password: pw });
        if (!signIn.data.session) {
          toast.success(
            "Аккаунт создан. Проверьте почту, затем войдите для подтверждения личности.",
          );
          setBusy(false);
          return;
        }
        uid = signIn.data.session.user.id;
      }
      setCreatedUserId(uid);
      setSignupStep("selfie1");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setBusy(false);
    }
  }

  async function uploadDataUrl(uid: string, dataUrl: string, name: string): Promise<string> {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${uid}/${name}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("verification").upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    return path;
  }

  async function onSelfie2Capture(dataUrl: string) {
    if (!selfie1 || !createdUserId) return;
    setSignupStep("submitting");
    setBusy(true);
    try {
      const info = parseIin(iin)!;
      const result = await compare({
        data: { selfie: dataUrl, reference: selfie1, context: "passenger_selfie_only" },
      });
      const confidence = result.liveness_ok ? result.confidence : Math.min(result.confidence, 0.5);
      const path = await uploadDataUrl(createdUserId, dataUrl, "selfie");
      await uploadDataUrl(createdUserId, selfie1, "selfie-ref");
      const { error } = await supabase.rpc("submit_passenger_verification", {
        _full_name: [lastName, firstName, patronymic.trim()].filter(Boolean).join(" "),
        _iin: iin,
        _dob: info.dob,
        _gender: info.gender,
        _selfie_path: path,
        _ai_confidence: confidence,
        _ai_reason: result.reason ?? "",
      });
      if (error) throw error;
      toast.success("Заявка отправлена. Ожидайте подтверждения.");
      void navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось завершить регистрацию");
      setSignupStep("selfie2");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      setBusy(true);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error(result.error.message ?? "Ошибка входа через Google");
      if (!result.redirected) void navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка входа через Google");
      setBusy(false);
    }
  }

  if (signupStep !== "form") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Подтверждение личности</h1>
                <p className="text-xs text-muted-foreground">
                  Сделайте два живых селфи для завершения регистрации.
                </p>
              </div>
            </div>

            {signupStep === "selfie1" && (
              <div className="mt-5">
                <CameraCapture
                  label="Шаг 1 из 2 — посмотрите прямо в камеру"
                  facing="user"
                  onCapture={(d) => {
                    setSelfie1(d);
                    setSignupStep("selfie2");
                  }}
                />
              </div>
            )}
            {signupStep === "selfie2" && (
              <div className="mt-5">
                <CameraCapture
                  label="Шаг 2 из 2 — слегка поверните голову"
                  facing="user"
                  onCapture={onSelfie2Capture}
                  busy={busy}
                />
              </div>
            )}
            {signupStep === "submitting" && (
              <div className="mt-8 grid place-items-center gap-3 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Сверяем фото и сохраняем…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <img src={APP_LOGO_SRC} alt="Senim" className="h-10 w-10 rounded-lg object-cover" />
          <span className="text-xl font-semibold">Senim</span>
        </div>
        {blockedNotice && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{blockedNotice}</AlertDescription>
          </Alert>
        )}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Вход</TabsTrigger>
              <TabsTrigger value="signup">Регистрация</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 pt-2">
                <Field label="Email" name="email" type="email" required autoComplete="email" />
                <Field
                  label="Пароль"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Войти
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Фамилия</Label>
                    <Input
                      id="last_name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      maxLength={60}
                      required
                      autoComplete="family-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">Имя</Label>
                    <Input
                      id="first_name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      maxLength={60}
                      required
                      autoComplete="given-name"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="patronymic">Отчество (необязательно)</Label>
                  <Input
                    id="patronymic"
                    value={patronymic}
                    onChange={(e) => setPatronymic(e.target.value)}
                    maxLength={60}
                    autoComplete="additional-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="iin_signup">ИИН</Label>
                  <Input
                    id="iin_signup"
                    inputMode="numeric"
                    pattern="\d{12}"
                    value={iin}
                    onChange={(e) => setIin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    required
                  />
                </div>
                {iin.length === 12 &&
                  (iinInfo ? (
                    <div className="grid grid-cols-3 gap-3">
                      <ReadOnly label="Дата рождения" value={iinInfo.dob} />
                      <ReadOnly label="Пол" value={genderRu} />
                      <ReadOnly label="Возраст" value={age != null ? String(age) : "—"} />
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>ИИН не прошёл проверку контрольной суммы.</AlertDescription>
                    </Alert>
                  ))}
                {iinInfo && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {canBeDriverByIin(iinInfo)
                        ? "По ИИН этот пользователь может пользоваться сервисом и позже подать заявку в водители."
                        : canBePassengerByIin(iinInfo)
                          ? "По ИИН этот пользователь может пользоваться сервисом как пассажир."
                          : "По ИИН регистрация недоступна: взрослые мужчины не допускаются к сервису."}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="phone_signup">Телефон</Label>
                  <Input
                    id="phone_signup"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatKzPhone(e.target.value))}
                    placeholder="+7 700 000 00 00"
                    maxLength={20}
                    required
                    autoComplete="tel"
                  />
                </div>
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <Field
                  label="Пароль"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    Сразу после нажатия кнопки нужно сделать{" "}
                    <span className="font-medium text-foreground">два живых селфи</span> для
                    подтверждения личности. Женщины 18+ смогут позже подать заявку в водители, дети
                    младше 18 лет пользуются сервисом как пассажиры.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || (iinInfo ? !canRegister : false)}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Продолжить
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> или <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={handleGoogle}
          >
            Продолжить с Google
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} readOnly tabIndex={-1} className="bg-muted/40" />
    </div>
  );
}
