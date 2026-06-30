import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
type Tx = Database["public"]["Tables"]["transactions"]["Row"];

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { user, isDriver } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    if (!user) return;
    const [{ data: w }, { data: t }] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setWallet(w); setTxs(t ?? []); setLoading(false);
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [user]);

  async function withdraw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const card_last4 = String(fd.get("card_last4") ?? "").slice(0, 4);
    const card_holder = String(fd.get("card_holder") ?? "").slice(0, 100);
    if (!Number.isFinite(amount) || amount < 10) return toast.error("Minimum 10");
    if (!/^\d{4}$/.test(card_last4)) return toast.error("Card last 4 must be 4 digits");
    try {
      setSubmitting(true);
      const { error } = await supabase.rpc("request_withdrawal", { _amount: amount, _card_last4: card_last4, _card_holder: card_holder });
      if (error) throw error;
      toast.success("Withdrawal requested");
      (e.target as HTMLFormElement).reset();
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="text-sm text-muted-foreground">Available balance</div>
        <div className="mt-1 text-3xl font-bold">{Number(wallet?.balance ?? 0).toFixed(2)} {wallet?.currency ?? "USD"}</div>
        <div className="mt-1 text-xs text-muted-foreground">Pending: {Number(wallet?.pending_balance ?? 0).toFixed(2)}</div>
      </Card>

      {isDriver && (
        <Card className="p-5">
          <h2 className="font-semibold">Withdraw to demo card</h2>
          <form onSubmit={withdraw} className="mt-3 space-y-3">
            <div className="space-y-1"><Label>Amount</Label><Input name="amount" type="number" min={10} step="0.01" required /></div>
            <div className="space-y-1"><Label>Card holder</Label><Input name="card_holder" required maxLength={100} /></div>
            <div className="space-y-1"><Label>Card last 4</Label><Input name="card_last4" inputMode="numeric" pattern="\d{4}" maxLength={4} required /></div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Request withdrawal
            </Button>
            <p className="text-xs text-muted-foreground">Minimum 10. Demo only — no real money moves.</p>
          </form>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-semibold">Transactions</h2>
        {txs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{t.description ?? t.type}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()} · <Badge variant="outline">{t.status}</Badge></div>
                </div>
                <div className={`font-semibold ${Number(t.amount) < 0 ? "text-destructive" : "text-success"}`}>
                  {Number(t.amount) > 0 ? "+" : ""}{Number(t.amount).toFixed(2)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
