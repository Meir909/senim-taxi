import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Car, MapPin, Wallet, Star, Shield, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Senim — Поездка за секунды" },
      { name: "description", content: "Закажите такси или станьте водителем. Отслеживание в реальном времени, честные тарифы, мгновенный заказ." },
      { property: "og:title", content: "Senim — Поездка за секунды" },
      { property: "og:description", content: "Закажите такси или станьте водителем в Senim." },
      { property: "og:image", content: "/icon-512.png" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Car className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Senim</span>
          </div>
          {!loading && (
            user ? (
              <Button asChild><Link to="/home">Открыть приложение</Link></Button>
            ) : (
              <Button asChild variant="outline"><Link to="/auth">Войти</Link></Button>
            )
          )}
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20 md:py-24">
            <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                  Сервис работает по всему городу
                </div>
                <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                  Поездка за <span className="text-primary">секунды</span>.
                </h1>
                <p className="mt-5 text-base text-muted-foreground sm:text-lg">
                  Закажите такси, следите за водителем в реальном времени или зарабатывайте за рулём. Всё в одном приложении.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link to={user ? "/home" : "/auth"}>Заказать поездку</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                    <Link to={user ? "/become-driver" : "/auth"}>Стать водителем</Link>
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center sm:gap-4">
                <Stat value="3 км" label="радиус поиска" />
                <Stat value="30 сек" label="на принятие" />
                <Stat value="4.9★" label="средний рейтинг" />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Почему Senim</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <Feature icon={<MapPin />} title="Слежение онлайн" desc="Видите водителя на карте каждые несколько секунд." />
            <Feature icon={<Zap />} title="Умный подбор" desc="Ближайший водитель в радиусе 3 км, 30 сек на принятие." />
            <Feature icon={<Wallet />} title="Кошелёк водителя" desc="Учёт заработка, мгновенный вывод средств." />
            <Feature icon={<Star />} title="Честные оценки" desc="Прозрачные рейтинги — выбирайте лучших." />
            <Feature icon={<Shield />} title="Безопасность" desc="Все водители проходят верификацию документов." />
            <Feature icon={<Car />} title="Любой район" desc="Поиск авто по всему городу, без зон." />
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-8 text-center text-primary-foreground sm:p-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Готовы поехать?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm opacity-90 sm:text-base">
              Создайте аккаунт за минуту и закажите первую поездку прямо сейчас.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-6">
              <Link to={user ? "/home" : "/auth"}>{user ? "Открыть приложение" : "Начать"}</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Senim. Все права защищены.
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-2xl font-bold text-primary sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
