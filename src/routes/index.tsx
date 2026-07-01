import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Baby, CarFront, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Senim — Поездка за секунды" },
      { name: "description", content: "Закажите такси или станьте водителем в Senim." },
    ],
  }),
  ssr: false,
  component: Entry,
});

function Entry() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Подключаем систему Senim…</p>
        </div>
      </div>
    );
  }
  if (user) return <Navigate to="/home" replace />;
  return <OnboardingScreen />;
}

const FEATURE_STEPS = [
  "Проверяем безопасный доступ",
  "Подключаем ближайших водителей",
  "Готовим детские и обычные тарифы",
  "Запускаем кошелёк и историю поездок",
];

function OnboardingScreen() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => (current < FEATURE_STEPS.length - 1 ? current + 1 : current));
    }, 900);
    return () => window.clearInterval(timer);
  }, []);

  const progress = ((step + 1) / FEATURE_STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.18),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#ecfeff_45%,_#f8fafc_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-10">
        <div className="space-y-6">
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs">
            Senim Taxi Platform
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Безопасные поездки, детские тарифы и быстрый старт в одном приложении
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Senim соединяет пассажиров и водителей с упором на верификацию личности,
              защиту ребёнка в поездке и прозрачные выплаты.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5 text-teal-600" />}
              title="Подтверждённые профили"
              text="Заказ поездки и доступ к роли водителя открываются только после верификации."
            />
            <FeatureCard
              icon={<Baby className="h-5 w-5 text-amber-600" />}
              title="Детский тариф"
              text="PIN на посадку и передачу ребёнка, отдельные правила безопасности и кресла."
            />
            <FeatureCard
              icon={<CarFront className="h-5 w-5 text-sky-600" />}
              title="Умная подача"
              text="Поиск ближайших водителей, realtime-статусы и ожидание с живой навигацией."
            />
            <FeatureCard
              icon={<Wallet className="h-5 w-5 text-emerald-600" />}
              title="Кошелёк и выплаты"
              text="История операций, пополнение, заработок водителя и контроль комиссий."
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="sm:min-w-44">
              <Link to="/auth">Начать</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="sm:min-w-44">
              <Link to="/settings/about">Подробнее</Link>
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden border-slate-200 bg-white/90 p-0 shadow-2xl backdrop-blur">
          <div className="border-b bg-slate-950 px-5 py-4 text-slate-50">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
              System Boot
            </div>
            <div className="mt-1 text-lg font-semibold">Инициализация Senim Core</div>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>Загрузка модулей</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 via-sky-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-slate-950 p-4 text-sm text-slate-200">
              {FEATURE_STEPS.map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      index <= step ? "bg-emerald-400" : "bg-slate-700"
                    }`}
                  />
                  <span className={index <= step ? "text-slate-100" : "text-slate-500"}>
                    {item}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              После входа вы сможете заказать поездку, пройти верификацию, стать водителем или
              использовать детский тариф с дополнительной защитой.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Card className="border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
        {icon}
      </div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
    </Card>
  );
}
