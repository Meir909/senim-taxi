import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, ShieldCheck, RefreshCw, CheckCircle2, XCircle, Clock, FileText, ExternalLink, Ban, Trash2, ShieldOff } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { deleteUserAdmin } from "@/lib/admin.functions";

type VR = Database["public"]["Tables"]["verification_requests"]["Row"];
type DocRow = Database["public"]["Tables"]["driver_documents"]["Row"];
type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const DOC_LABELS: Record<string, string> = {
  identity: "Удостоверение",
  license: "Водительское",
  vehicle_registration: "Свидетельство ТС",
  vehicle_documents: "Документы авто",
};

export const Route = createFileRoute("/_authenticated/admin/verifications")({
  component: AdminVerifications,
});

function AdminVerifications() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Верификации</h1>
      </div>
      <Tabs defaultValue="passengers">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="passengers">Пассажиры</TabsTrigger>
          <TabsTrigger value="drivers">Водители</TabsTrigger>
        </TabsList>
        <TabsContent value="passengers" className="mt-4">
          <PassengerList />
        </TabsContent>
        <TabsContent value="drivers" className="mt-4">
          <DriverList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PassengerList() {
  const [items, setItems] = useState<VR[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  async function load() {
    setLoading(true);
    let q = supabase.from("verification_requests").select("*").eq("kind", "passenger")
      .order("created_at", { ascending: false }).limit(100);
    if (filter === "pending") q = q.in("status", ["pending", "manual_review", "reupload_requested"]);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>Ожидают</Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Все</Button>
        <Button size="icon" variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {loading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Нет заявок</Card>
      ) : (
        <div className="space-y-3">{items.map((r) => <PassengerCard key={r.id} req={r} onChanged={load} />)}</div>
      )}
    </div>
  );
}

function PassengerCard({ req, onChanged }: { req: VR; onChanged: () => void }) {
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const paths = [req.selfie_path].filter(Boolean) as string[];
    if (paths.length === 0) return;
    void supabase.storage.from("verification").createSignedUrls(paths, 600).then(({ data }) => {
      const map: Record<string, string> = {};
      data?.forEach((d) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl; });
      setSigned(map);
    });
  }, [req.id, req.selfie_path]);

  async function review(decision: "approve" | "reject" | "reupload") {
    if (decision !== "approve" && !comment.trim()) { toast.error("Добавьте комментарий"); return; }
    setBusy(decision);
    const { error } = await supabase.rpc("admin_review_verification", {
      _request_id: req.id, _decision: decision, _comment: comment.trim() || "",
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
        <Badge variant="secondary">Пассажир</Badge>
        <Badge variant="outline">{req.status}</Badge>
        {req.ai_confidence !== null && <Badge variant="outline">AI {Math.round(Number(req.ai_confidence) * 100)}%</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{new Date(req.created_at).toLocaleString("ru-RU")}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="ФИО" value={req.full_name} />
        <Field label="ИИН" value={req.iin} />
        <Field label="Дата рождения" value={req.date_of_birth} />
        <Field label="Пол" value={req.gender === "male" ? "Мужской" : req.gender === "female" ? "Женский" : null} />
      </div>
      {req.selfie_path && <Photo label="Селфи" url={signed[req.selfie_path]} />}
      {isPending ? (
        <>
          <Textarea placeholder="Комментарий (обязателен для отклонения)" value={comment}
            onChange={(e) => setComment(e.target.value)} rows={2} maxLength={500} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => review("approve")} disabled={busy !== null}>
              {busy === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Одобрить
            </Button>
            <Button variant="outline" onClick={() => review("reupload")} disabled={busy !== null}>Запросить перезагрузку</Button>
            <Button variant="destructive" onClick={() => review("reject")} disabled={busy !== null}>Отклонить</Button>
          </div>
        </>
      ) : req.reviewer_comment && (
        <p className="text-sm text-muted-foreground">Комментарий: {req.reviewer_comment}</p>
      )}
    </Card>
  );
}

function DriverList() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [docs, setDocs] = useState<Record<string, DocRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  async function load() {
    setLoading(true);
    let q = supabase.from("drivers").select("*").order("submitted_at", { ascending: false, nullsFirst: false }).limit(100);
    if (filter === "pending") q = q.in("application_status", ["pending", "needs_reupload"]);
    const { data: ds, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = (ds ?? []) as DriverRow[];
    setDrivers(list);
    const ids = list.map((d) => d.id);
    if (ids.length) {
      const [ps, dd] = await Promise.all([
        supabase.from("profiles").select("*").in("id", ids),
        supabase.from("driver_documents").select("*").in("driver_id", ids),
      ]);
      const pmap: Record<string, ProfileRow> = {};
      (ps.data ?? []).forEach((p) => { pmap[p.id] = p as ProfileRow; });
      setProfiles(pmap);
      const dmap: Record<string, DocRow[]> = {};
      (dd.data ?? []).forEach((d) => {
        const arr = dmap[d.driver_id] ?? [];
        arr.push(d as DocRow);
        dmap[d.driver_id] = arr;
      });
      setDocs(dmap);
    } else {
      setProfiles({}); setDocs({});
    }
    setLoading(false);
  }
  useEffect(() => { void load(); }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>Ожидают</Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Все</Button>
        <Button size="icon" variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {loading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : drivers.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Нет заявок</Card>
      ) : (
        <div className="space-y-3">
          {drivers.map((d) => (
            <DriverCard key={d.id} driver={d} profile={profiles[d.id]} docs={docs[d.id] ?? []} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function DriverCard({ driver, profile, docs, onChanged }: { driver: DriverRow; profile?: ProfileRow; docs: DocRow[]; onChanged: () => void }) {
  const [signed, setSigned] = useState<Record<string, string>>({});

  useEffect(() => {
    const paths = [profile?.selfie_path, ...docs.map((d) => d.file_path)].filter(Boolean) as string[];
    if (paths.length === 0) return;
    void supabase.storage.from("verification").createSignedUrls(paths, 600).then(({ data }) => {
      const map: Record<string, string> = {};
      data?.forEach((x) => { if (x.path && x.signedUrl) map[x.path] = x.signedUrl; });
      setSigned(map);
    });
  }, [driver.id, profile?.selfie_path, docs.map((d) => d.file_path).join("|")]);

  const fullName = [profile?.last_name, profile?.first_name, profile?.patronymic].filter(Boolean).join(" ") || profile?.full_name || "—";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>Водитель</Badge>
        <Badge variant={driver.application_status === "approved" ? "default"
          : driver.application_status === "rejected" ? "destructive"
          : driver.application_status === "needs_reupload" ? "outline" : "secondary"}>
          {driver.application_status}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {driver.submitted_at ? new Date(driver.submitted_at).toLocaleString("ru-RU") : ""}
        </span>
      </div>

      <div className="flex gap-3">
        {profile?.selfie_path && signed[profile.selfie_path] ? (
          <a href={signed[profile.selfie_path]} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={signed[profile.selfie_path]} alt="Селфи" className="h-20 w-20 rounded-md border border-border object-cover" />
          </a>
        ) : (
          <div className="h-20 w-20 rounded-md border border-dashed border-border" />
        )}
        <div className="grid flex-1 grid-cols-2 gap-2 text-sm">
          <Field label="ФИО" value={fullName} />
          <Field label="ИИН" value={profile?.iin} />
          <Field label="Дата рождения" value={profile?.date_of_birth} />
          <Field label="Пол" value={profile?.gender === "female" ? "Женский" : profile?.gender === "male" ? "Мужской" : null} />
          <Field label="Госномер" value={driver.vehicle_plate} />
          <Field label="Страна" value={driver.vehicle_country} />
          <Field label="Детское кресло" value={driver.child_seat ? "Да" : "Нет"} />
        </div>
      </div>

      <div className="space-y-2">
        {(["identity", "license", "vehicle_registration", "vehicle_documents"] as const).map((kind) => {
          const doc = docs.find((d) => d.kind === kind);
          return <DocReviewRow key={kind} kind={kind} doc={doc} signedUrl={doc ? signed[doc.file_path] : undefined} onChanged={onChanged} />;
        })}
      </div>
    </Card>
  );
}

function DocReviewRow({ kind, doc, signedUrl, onChanged }: { kind: string; doc?: DocRow; signedUrl?: string; onChanged: () => void }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function decide(decision: "approve" | "reject") {
    if (!doc) return;
    if (decision === "reject" && comment.trim().length < 2) { toast.error("Добавьте комментарий"); return; }
    setBusy(decision);
    const { error } = await supabase.rpc("admin_review_document", {
      _doc_id: doc.id, _decision: decision, _comment: comment.trim(),
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Решение сохранено");
    setComment(""); setOpen(false);
    onChanged();
  }

  const statusIcon = !doc ? <Clock className="h-4 w-4 text-muted-foreground" />
    : doc.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-success" />
    : doc.status === "rejected" ? <XCircle className="h-4 w-4 text-destructive" />
    : <Clock className="h-4 w-4 text-muted-foreground" />;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {statusIcon}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{DOC_LABELS[kind] ?? kind}</div>
            <div className="text-xs text-muted-foreground">
              {doc ? (doc.status === "approved" ? "Одобрено" : doc.status === "rejected" ? "Отклонено" : "На проверке") : "Не загружен"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {signedUrl && (
            <a href={signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <FileText className="h-3.5 w-3.5" /> Открыть <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {doc && doc.status !== "approved" && (
            <Button size="sm" variant="outline" onClick={() => setOpen((s) => !s)}>Решение</Button>
          )}
        </div>
      </div>
      {doc?.comment && doc.status === "rejected" && (
        <p className="mt-2 text-xs text-destructive">Причина: {doc.comment}</p>
      )}
      {open && doc && (
        <div className="mt-2 space-y-2">
          <Textarea placeholder="Комментарий (обязателен при отклонении)" rows={2} maxLength={500}
            value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide("approve")} disabled={busy !== null}>
              {busy === "approve" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Одобрить
            </Button>
            <Button size="sm" variant="destructive" onClick={() => decide("reject")} disabled={busy !== null}>
              {busy === "reject" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Отклонить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
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
          <img src={url} alt={label} className="aspect-square w-40 rounded-md border border-border object-cover" />
        </a>
      ) : (
        <div className="grid aspect-square w-40 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground">—</div>
      )}
    </div>
  );
}
