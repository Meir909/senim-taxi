import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Car, Loader2, Info } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Вход — Senim" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Неверный email").max(255);
const passwordSchema = z.string().min(6, "Минимум 6 символов").max(72);
const nameSchema = z.string().trim().min(1, "Введите имя").max(100);

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/home", replace: true });
  }, [user, loading, navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const email = emailSchema.parse(fd.get("email"));
      const password = passwordSchema.parse(fd.get("password"));
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("С возвращением!");
      void navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось войти");
    } finally { setBusy(false); }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const email = emailSchema.parse(fd.get("email"));
      const password = passwordSchema.parse(fd.get("password"));
      const full_name = nameSchema.parse(fd.get("full_name"));
      setBusy(true);
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
          data: { full_name },
        },
      });
      if (error) throw error;
      toast.success("Аккаунт создан. Можно войти.");
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
                <Field label="Полное имя" name="full_name" required autoComplete="name" />
                <Field label="Email" name="email" type="email" required autoComplete="email" />
                <Field label="Пароль" name="password" type="password" required autoComplete="new-password" />
                <Button type="submit" className="w-full" disabled={busy}>
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
