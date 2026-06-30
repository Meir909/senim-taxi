import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type VR = Database["public"]["Tables"]["verification_requests"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/verifications")({
  component: AdminVerifications,
});

function AdminVerifications() {
  const [items, setItems] = useState<VR[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  async function load() {
    setLoading(true);
    let q = supabase.from("verification_requests").select("*").order("created_at", { ascending: false }).limit(100);
    if (filter === "pending") q = q.in("status", ["pending", "manual_review", "reupload_requested"]);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Верификации</h1>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "pending" ? "default" : "outline"}
            onClick={() => setFilter("pending")}
          >Ожидают</Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >Все</Button>
          <Button size="icon" variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Нет заявок</Card>
      ) : (
        <div className="space-y-3">{items.map((r) => <RequestCard key={r.id} req={r} onChanged={load} />)}</div>
      )}
    </div>
  );
}

function RequestCard({ req, onChanged }: { req: VR; onChanged: () => void }) {
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const paths = [req.selfie_path, req.license_photo_path, req.vehicle_doc_path, req.document_path].filter(Boolean) as string[];
    if (paths.length === 0) return;
    void supabase.storage.from("verification").createSignedUrls(paths, 600).then(({ data }) => {
      const map: Record<string, string> = {};
      data?.forEach((d) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl; });
      setSigned(map);
    });
  }, [req.id, req.selfie_path, req.license_photo_path, req.vehicle_doc_path, req.document_path]);

  async function review(decision: "approve" | "reject" | "reupload") {
    if (decision !== "approve" && !comment.trim()) {
      toast.error("Добавьте комментарий");
      return;
    }
    setBusy(decision);
    const { error } = await supabase.rpc("admin_review_verification", {
      _request_id: req.id,
      _decision: decision,
      _comment: comment.trim() || "",
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Решение сохранено");
    onChanged();
  }

  const isPending = ["pending", "manual_review", "reupload_requested"].includes(req.status);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={req.kind === "driver" ? "default" : "secondary"}>{req.kind === "driver" ? "Водитель" : "Пассажир"}</Badge>
        <Badge variant="outline">{req.status}</Badge>
        {req.ai_confidence !== null && (
          <Badge variant="outline">AI {Math.round(Number(req.ai_confidence) * 100)}%</Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{new Date(req.created_at).toLocaleString("ru-RU")}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="ФИО" value={req.full_name} />
        <Field label="ИИН" value={req.iin} />
        <Field label="Дата рождения" value={req.date_of_birth} />
        <Field label="Пол" value={req.gender === "male" ? "Мужской" : req.gender === "female" ? "Женский" : null} />
      </div>

      {req.ai_reason && <p className="text-xs text-muted-foreground">AI: {req.ai_reason}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {req.selfie_path && <Photo label="Селфи" url={signed[req.selfie_path]} />}
        {req.license_photo_path && <Photo label="ВУ" url={signed[req.license_photo_path]} />}
        {req.vehicle_doc_path && <Photo label="Тех. паспорт" url={signed[req.vehicle_doc_path]} />}
        {req.document_path && <Photo label="Документ" url={signed[req.document_path]} />}
      </div>

      {isPending ? (
        <>
          <Textarea
            placeholder="Комментарий (обязателен для отклонения / повторной загрузки)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={500}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => review("approve")} disabled={busy !== null}>
              {busy === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Одобрить
            </Button>
            <Button variant="outline" onClick={() => review("reupload")} disabled={busy !== null}>
              Запросить перезагрузку
            </Button>
            <Button variant="destructive" onClick={() => review("reject")} disabled={busy !== null}>
              Отклонить
            </Button>
          </div>
        </>
      ) : (
        req.reviewer_comment && <p className="text-sm text-muted-foreground">Комментарий: {req.reviewer_comment}</p>
      )}
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

function Photo({ label, url }: { label: string; url?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img src={url} alt={label} className="aspect-square w-full rounded-md border border-border object-cover" />
        </a>
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
          —
        </div>
      )}
    </div>
  );
}
