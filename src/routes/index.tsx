import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Car, MapPin, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Senim — Поездка за секунды" },
      { name: "description", content: "Закажите такси или станьте водителем. Отслеживание в реальном времени, честные тарифы, мгновенный заказ." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Car className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Senim</span>
          </div>
          {!loading && (
            user ? (
              <Button asChild><Link to="/home">Открыть</Link></Button>
            ) : (
              <Button asChild variant="outline"><Link to="/auth">Войти</Link></Button>
            )
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <section className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Ваша поездка уже в пути.
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Закажите такси за секунды, следите за водителем в реальном времени или зарабатывайте за рулём — всё в одном приложении.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="w-full sm:w-auto"><Link to={user ? "/home" : "/auth"}>Заказать поездку</Link></Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto"><Link to={user ? "/become-driver" : "/auth"}>Стать водителем</Link></Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <Feature icon={<MapPin className="h-5 w-5" />} title="Слежение онлайн" desc="Видите водителя на карте каждые несколько секунд." />
            <Feature icon={<Car className="h-5 w-5" />} title="Умный подбор" desc="Ближайший водитель в радиусе 3 км, 30 сек на принятие." />
            <Feature icon={<Wallet className="h-5 w-5" />} title="Кошелёк водителя" desc="Учёт заработка, мгновенный вывод средств." />
            <Feature icon={<Car className="h-5 w-5" />} title="Честные тарифы" desc="Прозрачные цены, без сюрпризов." />
          </div>
        </section>
      </main>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">{icon}</div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
