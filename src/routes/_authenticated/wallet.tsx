import { createFileRoute } from "@tanstack/react-router";
<<<<<<< HEAD
import { useCallback, useEffect, useState } from "react";
=======
import { useEffect, useState } from "react";
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, ArrowDownToLine, Wallet as WalletIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
type Tx = Database["public"]["Tables"]["transactions"]["Row"];

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

const TX_TYPE: Record<string, string> = {
  ride_earning: "Заработок с поездки",
  ride_payment: "Оплата поездки",
  withdrawal: "Вывод средств",
  topup: "Пополнение",
  refund: "Возврат",
  commission: "Комиссия",
};
const TX_STATUS: Record<string, string> = {
  pending: "В обработке",
  completed: "Выполнено",
  failed: "Ошибка",
  cancelled: "Отменено",
};

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000];

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
}

function WalletPage() {
  const { user, isDriver } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"topup" | "withdraw">("topup");
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [card, setCard] = useState<string>("");
  const [holder, setHolder] = useState<string>("");

<<<<<<< HEAD
  const refresh = useCallback(async () => {
    if (!user) return;
    const [{ data: w }, { data: t }] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
=======
  async function refresh() {
    if (!user) return;
    const [{ data: w }, { data: t }] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    ]);
    setWallet(w);
    setTxs(t ?? []);
    setLoading(false);
<<<<<<< HEAD
  }, [user]);

  useEffect(() => {
    if (!user) {
      setWallet(null);
      setTxs([]);
      setLoading(false);
      return;
    }

    void refresh();
  }, [user, refresh]);
=======
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231

  const last4 = card.replace(/\D/g, "").slice(-4);
  const amt = Number(amount);

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(amt) || amt < 100) return toast.error("Минимум 100 ₸");
    if (!/^\d{4}$/.test(last4)) return toast.error("Введите номер карты");
    try {
      setSubmitting(true);
      const { error } = await supabase.rpc("topup_wallet", { _amount: amt, _card_last4: last4 });
      if (error) throw error;
      toast.success(`Зачислено ${fmt(amt)} ₸`);
      setAmount("");
      setCard("");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось пополнить");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!Number.isFinite(amt) || amt < 500) return toast.error("Минимум 500 ₸");
    if (!/^\d{4}$/.test(last4)) return toast.error("Введите номер карты");
    if (holder.trim().length < 2) return toast.error("Укажите владельца карты");
    try {
      setSubmitting(true);
      const { error } = await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Заявка на вывод средств отправлена",
        body: `Запрос на вывод ${fmt(amt)} ₸ на карту ****${last4} (${holder.trim()}) принят. Мы свяжемся с вами в течение 24 часов.`,
        type: "withdrawal_request",
        data: {
          amount: amt,
          card_last4: last4,
          card_holder: holder.trim(),
        },
      });
      if (error) throw error;
      toast.success("Заявка на вывод отправлена");
      setAmount("");
      setCard("");
      setHolder("");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось");
    } finally {
      setSubmitting(false);
    }
  }

<<<<<<< HEAD
=======

>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  function formatCard(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }

  if (loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const balance = Number(wallet?.balance ?? 0);
  const pending = Number(wallet?.pending_balance ?? 0);

  return (
    <div className="space-y-4">
<<<<<<< HEAD
=======
      {/* Balance card */}
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground shadow-lg">
        <div className="flex items-center gap-2 text-sm opacity-90">
          <WalletIcon className="h-4 w-4" /> Баланс кошелька
        </div>
        <div className="mt-2 text-4xl font-bold tracking-tight">{fmt(balance)} ₸</div>
        {pending > 0 && (
          <div className="mt-1 text-xs opacity-90">В ожидании вывода: {fmt(pending)} ₸</div>
        )}
      </Card>

<<<<<<< HEAD
=======
      {/* Tabs */}
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={tab === "topup" ? "default" : "outline"}
          size="lg"
          onClick={() => setTab("topup")}
          className="h-12"
        >
          <Plus className="mr-2 h-4 w-4" /> Пополнить
        </Button>
        <Button
          variant={tab === "withdraw" ? "default" : "outline"}
          size="lg"
          onClick={() => setTab("withdraw")}
          disabled={!isDriver}
          className="h-12"
        >
          <ArrowDownToLine className="mr-2 h-4 w-4" /> Вывод
        </Button>
      </div>

      {tab === "topup" && (
        <Card className="p-5">
          <h2 className="font-semibold">Пополнение картой</h2>
<<<<<<< HEAD
          <p className="mt-1 text-xs text-muted-foreground">
            Демо-режим. Реальные деньги не списываются.
          </p>
=======
          <p className="mt-1 text-xs text-muted-foreground">Демо-режим. Реальные деньги не списываются.</p>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
          <form onSubmit={handleTopup} className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={amt === v ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAmount(String(v))}
                >
                  {fmt(v)} ₸
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Сумма, ₸</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={100}
                step={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Номер карты</Label>
              <Input
                inputMode="numeric"
                value={formatCard(card)}
                onChange={(e) => setCard(e.target.value)}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Пополнить
            </Button>
          </form>
        </Card>
      )}

      {tab === "withdraw" && (
        <Card className="p-5">
          {!isDriver ? (
            <p className="text-sm text-muted-foreground">
              Вывод средств доступен только водителям. Станьте водителем в профиле.
            </p>
          ) : (
            <>
              <h2 className="font-semibold">Вывод на карту</h2>
<<<<<<< HEAD
              <p className="mt-1 text-xs text-muted-foreground">
                Минимум 500 ₸. Демо — деньги не переводятся.
              </p>
=======
              <p className="mt-1 text-xs text-muted-foreground">Минимум 500 ₸. Демо — деньги не переводятся.</p>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
              <form onSubmit={handleWithdraw} className="mt-4 space-y-3">
                <div className="space-y-1">
                  <Label>Сумма, ₸</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={500}
                    step={100}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Владелец карты</Label>
<<<<<<< HEAD
                  <Input
                    value={holder}
                    onChange={(e) => setHolder(e.target.value)}
                    maxLength={100}
                    placeholder="IVAN IVANOV"
                    required
                  />
=======
                  <Input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={100} placeholder="IVAN IVANOV" required />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
                </div>
                <div className="space-y-1">
                  <Label>Номер карты</Label>
                  <Input
                    inputMode="numeric"
                    value={formatCard(card)}
                    onChange={(e) => setCard(e.target.value)}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    required
                  />
                </div>
<<<<<<< HEAD
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={submitting || balance < 500}
                >
=======
                <Button type="submit" size="lg" className="w-full" disabled={submitting || balance < 500}>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Запросить вывод
                </Button>
                {balance < 500 && (
                  <p className="text-xs text-muted-foreground">Недостаточно средств на балансе.</p>
                )}
              </form>
            </>
          )}
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-semibold">Транзакции</h2>
        {txs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Транзакций пока нет.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {txs.map((t) => {
              const v = Number(t.amount);
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
<<<<<<< HEAD
                    <div className="truncate font-medium">
                      {t.description ?? TX_TYPE[t.type] ?? t.type}
                    </div>
=======
                    <div className="truncate font-medium">{t.description ?? TX_TYPE[t.type] ?? t.type}</div>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{new Date(t.created_at).toLocaleString("ru-RU")}</span>
                      <Badge variant="outline">{TX_STATUS[t.status] ?? t.status}</Badge>
                    </div>
                  </div>
<<<<<<< HEAD
                  <div
                    className={`shrink-0 font-semibold ${v < 0 ? "text-destructive" : "text-success"}`}
                  >
=======
                  <div className={`shrink-0 font-semibold ${v < 0 ? "text-destructive" : "text-success"}`}>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
                    {v > 0 ? "+" : ""}
                    {fmt(v)} ₸
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
