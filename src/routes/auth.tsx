import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { parseIin } from "@/lib/iin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Car, Loader2, Info, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Вход — Senim" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Неверный email").max(255);
const passwordSchema = z.string().min(6, "Минимум 6 символов").max(72);
const nameSchema = z.string().trim().min(1, "Обязательное поле").max(60);
const phoneSchema = z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, "Неверный телефон");

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const blockedNotice = useMemo(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search).get("blocked");
    return p ? decodeURIComponent(p) : null;
  }, []);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/home", replace: true });
  }, [user, loading, navigate]);

  // Signup form state for live IIN-derived fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [phone, setPhone] = useState("");
  const [iin, setIin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const iinInfo = useMemo(() => (iin.length === 12 ? parseIin(iin) : null), [iin]);
  const genderRu = iinInfo ? (iinInfo.gender === "female" ? "Женский" : "Мужской") : "";

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
    } finally { setBusy(false); }
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
      if (info.gender !== "female") {
        throw new Error("Приложение предназначено только для женщин и детей.");
      }
      const dob = new Date(info.dob);
      const eighteen = new Date(); eighteen.setFullYear(eighteen.getFullYear() - 18);
      if (dob > eighteen) throw new Error("Регистрация доступна с 18 лет");

      setBusy(true);
      const fullName = [ln, fn, patronymic.trim()].filter(Boolean).join(" ");
      const { data, error } = await supabase.auth.signUp({
        email: em, password: pw,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-identity`,
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
      if (data.session) {
        toast.success("Аккаунт создан. Подтвердите личность.");
        void navigate({ to: "/verify-identity", replace: true });
        return;
      }
      const signIn = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (signIn.data.session) {
        toast.success("Аккаунт создан. Подтвердите личность.");
        void navigate({ to: "/verify-identity", replace: true });
      } else {
        toast.success("Аккаунт создан. Проверьте почту, затем войдите.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось зарегистрироваться");
    } finally { setBusy(false); }
  }

  async function handleGoogle() {
    try {
      setBusy(true);
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw new Error(result.error.message ?? "Ошибка входа через Google");
      if (!result.redirected) void navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка входа через Google");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Car className="h-5 w-5" /></div>
          <span className="text-xl font-semibold">Senim</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Вход</TabsTrigger>
              <TabsTrigger value="signup">Регистрация</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 pt-2">
                <Field label="Email" name="email" type="email" required autoComplete="email" />
                <Field label="Пароль" name="password" type="password" required autoComplete="current-password" />
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
                    <Input id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} required autoComplete="family-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">Имя</Label>
                    <Input id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} required autoComplete="given-name" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="patronymic">Отчество (необязательно)</Label>
                  <Input id="patronymic" value={patronymic} onChange={(e) => setPatronymic(e.target.value)} maxLength={60} autoComplete="additional-name" />
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
                {iin.length === 12 && (
                  iinInfo ? (
                    <div className="grid grid-cols-2 gap-3">
                      <ReadOnly label="Дата рождения" value={iinInfo.dob} />
                      <ReadOnly label="Пол" value={genderRu} />
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>ИИН не прошёл проверку контрольной суммы.</AlertDescription>
                    </Alert>
                  )
                )}
                {iinInfo && iinInfo.gender !== "female" && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Приложение предназначено только для женщин и детей.</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="phone_signup">Телефон</Label>
                  <Input id="phone_signup" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 700 000 00 00" maxLength={20} required autoComplete="tel" />
                </div>
                <Field label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                <Field label="Пароль" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    Сначала вы регистрируетесь как <span className="font-medium text-foreground">пассажир</span>. После создания аккаунта потребуется живое селфи и подтверждение администратора. Стать водителем можно позже в профиле.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={busy || (iinInfo?.gender !== undefined && iinInfo.gender !== "female")}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Создать аккаунт
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> или <div className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={handleGoogle}>
            Продолжить с Google
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
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
