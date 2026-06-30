import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Car, MapPin, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Senim — Book a ride in seconds" },
      { name: "description", content: "Request a ride or sign up to drive. Real-time tracking, fair fares, instant dispatch." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Car className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Senim</span>
          </div>
          {!loading && (
            user ? (
              <Button asChild><Link to="/home">Open app</Link></Button>
            ) : (
              <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
            )
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Your ride, on the way.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Book a ride in seconds, follow your driver in real time, or earn behind the wheel — all in one app.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to={user ? "/home" : "/auth"}>Get a ride</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to={user ? "/become-driver" : "/auth"}>Drive with us</Link></Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Feature icon={<MapPin className="h-5 w-5" />} title="Real-time tracking" desc="See your driver move on the map every few seconds." />
            <Feature icon={<Car className="h-5 w-5" />} title="Smart dispatch" desc="Closest available driver within 3 km, 30s to accept." />
            <Feature icon={<Wallet className="h-5 w-5" />} title="Driver wallet" desc="Earnings tracked, instant withdrawals." />
            <Feature icon={<Car className="h-5 w-5" />} title="Fair fares" desc="Transparent pricing, no surprises." />
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
