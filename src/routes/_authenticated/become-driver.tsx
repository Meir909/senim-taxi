import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
<<<<<<< HEAD
import { useCallback, useEffect, useState } from "react";
=======
import { useEffect, useState } from "react";
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
<<<<<<< HEAD
import {
  Loader2,
  ShieldAlert,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { canBeDriverByIin, getAgeFromDob, parseIin } from "@/lib/iin";
=======
import { Loader2, ShieldAlert, FileText, CheckCircle2, XCircle, Clock, Upload, Image as ImageIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231

export const Route = createFileRoute("/_authenticated/become-driver")({
  component: BecomeDriver,
});

type DocKind = "identity" | "license" | "vehicle_documents";
type DocStatus = Database["public"]["Enums"]["driver_doc_status"];
type AppStatus = Database["public"]["Enums"]["driver_app_status"];

const DOC_LABELS: Record<DocKind, string> = {
  identity: "Удостоверение личности",
  license: "Водительское удостоверение",
  vehicle_documents: "Документы на автомобиль",
};
const DOC_ORDER: DocKind[] = ["identity", "license", "vehicle_documents"];
const ACCEPT = "application/pdf,image/jpeg,image/png";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

type DocRow = {
  id: string;
  kind: DocKind;
  file_path: string;
  mime_type: string;
  status: DocStatus;
  comment: string | null;
};

type Profile = {
  iin: string | null;
  date_of_birth: string | null;
  gender: string | null;
  first_name: string | null;
  last_name: string | null;
  patronymic: string | null;
  verification_status: string;
};

type DriverRow = {
  application_status: AppStatus;
  vehicle_plate: string | null;
  vehicle_country: string | null;
  child_seat: boolean;
  review_comment: string | null;
};

function BecomeDriver() {
  const { user, refreshDriver } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loadingState, setLoadingState] = useState(true);

  const [plate, setPlate] = useState("");
  const [country, setCountry] = useState("Казахстан");
  const [childSeat, setChildSeat] = useState<"yes" | "no" | "">("");
  const [files, setFiles] = useState<Partial<Record<DocKind, File>>>({});
  const [busy, setBusy] = useState(false);

<<<<<<< HEAD
  const load = useCallback(async () => {
    if (!user) return;
    setLoadingState(true);
    const [p, d, dd] = await Promise.all([
      supabase
        .from("profiles")
        .select("iin,date_of_birth,gender,first_name,last_name,patronymic,verification_status")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("drivers")
        .select("application_status,vehicle_plate,vehicle_country,child_seat,review_comment")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("driver_documents")
=======
  async function load() {
    if (!user) return;
    setLoadingState(true);
    const [p, d, dd] = await Promise.all([
      supabase.from("profiles")
        .select("iin,date_of_birth,gender,first_name,last_name,patronymic,verification_status")
        .eq("id", user.id).maybeSingle(),
      supabase.from("drivers")
        .select("application_status,vehicle_plate,vehicle_country,child_seat,review_comment")
        .eq("id", user.id).maybeSingle(),
      supabase.from("driver_documents")
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        .select("id,kind,file_path,mime_type,status,comment")
        .eq("driver_id", user.id)
        .in("kind", DOC_ORDER),
    ]);
    if (p.data) setProfile(p.data as Profile);
    if (d.data) {
      setDriver(d.data as DriverRow);
      setPlate(d.data.vehicle_plate ?? "");
      setCountry(d.data.vehicle_country ?? "Казахстан");
      setChildSeat(d.data.child_seat ? "yes" : "no");
    }
    setDocs(((dd.data as DocRow[] | null) ?? []).filter((x) => DOC_ORDER.includes(x.kind)));
    setLoadingState(false);
<<<<<<< HEAD
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadFile(file: File, kind: DocKind): Promise<{ path: string; mime: string }> {
    if (!user) throw new Error("Нет сессии");
    if (!ALLOWED_MIME.has(file.type))
      throw new Error(
        `Неподдерживаемый формат для «${DOC_LABELS[kind]}». Допустимы PDF, JPG, PNG.`,
      );
=======
  }

  useEffect(() => { void load(); }, [user]);

  async function uploadFile(file: File, kind: DocKind): Promise<{ path: string; mime: string }> {
    if (!user) throw new Error("Нет сессии");
    if (!ALLOWED_MIME.has(file.type)) throw new Error(`Неподдерживаемый формат для «${DOC_LABELS[kind]}». Допустимы PDF, JPG, PNG.`);
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    if (file.size > MAX_BYTES) throw new Error(`Файл «${DOC_LABELS[kind]}» больше 10 МБ`);
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const path = `${user.id}/driver/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("verification").upload(path, file, {
<<<<<<< HEAD
      contentType: file.type,
      upsert: true,
=======
      contentType: file.type, upsert: true,
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    });
    if (error) throw error;
    return { path, mime: file.type };
  }

  async function submitApplication(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !profile) return;
<<<<<<< HEAD
    const parsed = profile.iin ? parseIin(profile.iin) : null;
    if (!parsed || !canBeDriverByIin(parsed)) {
      toast.error("Водителем может стать только женщина 18+ с действительным ИИН.");
=======
    if (profile.gender !== "female") {
      toast.error("Только женщины могут зарегистрироваться в качестве водителя.");
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      return;
    }
    if (!plate.trim() || !country.trim() || !childSeat) {
      toast.error("Заполните данные авто и наличие детского кресла");
      return;
    }
    for (const k of DOC_ORDER) {
<<<<<<< HEAD
      if (!files[k]) {
        toast.error(`Загрузите: ${DOC_LABELS[k]}`);
        return;
      }
=======
      if (!files[k]) { toast.error(`Загрузите: ${DOC_LABELS[k]}`); return; }
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    }
    setBusy(true);
    try {
      const uploaded = {} as Record<DocKind, { path: string; mime: string }>;
      for (const k of DOC_ORDER) {
        uploaded[k] = await uploadFile(files[k]!, k);
      }
      const { error } = await supabase.rpc("submit_driver_application", {
        _vehicle_plate: plate.trim(),
        _vehicle_country: country.trim(),
        _child_seat: childSeat === "yes",
        _identity_path: uploaded.identity.path,
        _identity_mime: uploaded.identity.mime,
        _license_path: uploaded.license.path,
        _license_mime: uploaded.license.mime,
        _vehicle_documents_path: uploaded.vehicle_documents.path,
        _vehicle_documents_mime: uploaded.vehicle_documents.mime,
<<<<<<< HEAD
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
=======
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      } as any);
      if (error) throw error;
      toast.success("Заявка отправлена на проверку");
      await refreshDriver();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить");
<<<<<<< HEAD
    } finally {
      setBusy(false);
    }
=======
    } finally { setBusy(false); }
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  }

  async function reuploadDoc(kind: DocKind, file: File) {
    if (!user) return;
    setBusy(true);
    try {
      const u = await uploadFile(file, kind);
      const { error } = await supabase.rpc("reupload_driver_document", {
<<<<<<< HEAD
        _kind: kind,
        _path: u.path,
        _mime: u.mime,
=======
        _kind: kind, _path: u.path, _mime: u.mime,
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      });
      if (error) throw error;
      toast.success(`Файл «${DOC_LABELS[kind]}» загружен повторно`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить");
<<<<<<< HEAD
    } finally {
      setBusy(false);
    }
  }

  if (loadingState || !profile) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const parsedProfileIin = profile.iin ? parseIin(profile.iin) : null;
  const canBecomeDriver = parsedProfileIin ? canBeDriverByIin(parsedProfileIin) : false;

  if (!canBecomeDriver) {
=======
    } finally { setBusy(false); }
  }

  if (loadingState || !profile) {
    return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (profile.gender !== "female") {
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    return (
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <h1 className="text-lg font-semibold">Регистрация водителя недоступна</h1>
<<<<<<< HEAD
            <p className="mt-1 text-sm text-muted-foreground">
              Водителем может стать только женщина, которой уже исполнилось 18 лет.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/passenger">К поездкам</Link>
            </Button>
=======
            <p className="mt-1 text-sm text-muted-foreground">Только женщины могут зарегистрироваться в качестве водителя.</p>
            <Button asChild className="mt-4" variant="outline"><Link to="/passenger">К поездкам</Link></Button>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
          </div>
        </div>
      </Card>
    );
  }

  const hasApplication = driver !== null;
  const status = driver?.application_status;

  if (status === "approved") {
    return (
      <Card className="p-5 sm:p-6">
        <h1 className="text-lg font-semibold">Вы водитель</h1>
<<<<<<< HEAD
        <p className="mt-1 text-sm text-muted-foreground">
          Заявка одобрена — раздел водителя доступен.
        </p>
        <Button className="mt-4 w-full" onClick={() => void navigate({ to: "/driver" })}>
          В раздел водителя
        </Button>
=======
        <p className="mt-1 text-sm text-muted-foreground">Заявка одобрена — раздел водителя доступен.</p>
        <Button className="mt-4 w-full" onClick={() => void navigate({ to: "/driver" })}>В раздел водителя</Button>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      </Card>
    );
  }

  if (hasApplication && (status === "pending" || status === "needs_reupload")) {
    return (
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">Заявка водителя</h1>
          <Badge variant={status === "needs_reupload" ? "destructive" : "secondary"}>
            {status === "needs_reupload" ? "Нужна перезагрузка" : "На проверке"}
          </Badge>
        </div>
        {driver?.review_comment && (
          <Alert>
            <AlertTitle>Комментарий администратора</AlertTitle>
            <AlertDescription>{driver.review_comment}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Госномер" value={driver?.vehicle_plate} />
          <Info label="Страна авто" value={driver?.vehicle_country} />
          <Info label="Детское кресло" value={driver?.child_seat ? "Да" : "Нет"} />
        </div>
        <div className="space-y-2">
          {DOC_ORDER.map((kind) => {
            const doc = docs.find((d) => d.kind === kind);
<<<<<<< HEAD
            return (
              <DocReuploadRow
                key={kind}
                kind={kind}
                doc={doc}
                disabled={busy}
                onPick={(f) => void reuploadDoc(kind, f)}
              />
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Решение по всей заявке будет принято, когда все документы получат статус «Одобрено».
        </p>
=======
            return <DocReuploadRow key={kind} kind={kind} doc={doc} disabled={busy} onPick={(f) => void reuploadDoc(kind, f)} />;
          })}
        </div>
        <p className="text-xs text-muted-foreground">Решение по всей заявке будет принято, когда все документы получат статус «Одобрено».</p>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Заявка водителя</h1>
<<<<<<< HEAD
        <p className="mt-1 text-sm text-muted-foreground">
          Подать заявку может только женщина 18+ с действующим водительским удостоверением. Данные
          авто и 3 документа. Личность уже подтверждена при регистрации.
        </p>
        {parsedProfileIin && (
          <p className="mt-1 text-xs text-muted-foreground">
            По ИИН: возраст {getAgeFromDob(parsedProfileIin.dob)} лет, пол{" "}
            {parsedProfileIin.gender === "female" ? "женский" : "мужской"}.
          </p>
        )}
=======
        <p className="mt-1 text-sm text-muted-foreground">Данные авто и 3 документа. Личность уже подтверждена при регистрации.</p>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      </div>
      {status === "rejected" && (
        <Alert variant="destructive">
          <AlertTitle>Предыдущая заявка отклонена</AlertTitle>
<<<<<<< HEAD
          <AlertDescription>
            {driver?.review_comment ?? "Подайте заявку заново с корректными данными."}
          </AlertDescription>
=======
          <AlertDescription>{driver?.review_comment ?? "Подайте заявку заново с корректными данными."}</AlertDescription>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        </Alert>
      )}
      <form onSubmit={submitApplication} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Row label="Госномер" value={plate} onChange={setPlate} placeholder="A 123 BC" required />
<<<<<<< HEAD
          <Row
            label="Страна авто"
            value={country}
            onChange={setCountry}
            placeholder="Казахстан"
            required
          />
=======
          <Row label="Страна авто" value={country} onChange={setCountry} placeholder="Казахстан" required />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        </div>

        <div className="space-y-2">
          <Label>Детское кресло</Label>
<<<<<<< HEAD
          <RadioGroup
            value={childSeat}
            onValueChange={(v) => setChildSeat(v as "yes" | "no")}
            className="flex gap-4"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" id="cs-yes" /> Да
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" id="cs-no" /> Нет
            </label>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Если кресло есть, вы сможете получать тарифы с перевозкой детей. Если кресла нет,
            детские тарифы будут недоступны.
          </p>
=======
          <RadioGroup value={childSeat} onValueChange={(v) => setChildSeat(v as "yes" | "no")} className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="yes" id="cs-yes" /> Да</label>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="no" id="cs-no" /> Нет</label>
          </RadioGroup>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        </div>

        <div className="space-y-2 pt-2">
          <h2 className="text-sm font-semibold">Документы (фото)</h2>
<<<<<<< HEAD
          <p className="text-xs text-muted-foreground">
            Загрузите чёткие фото или PDF каждого документа. JPG, PNG или PDF до 10 МБ.
          </p>
          {DOC_ORDER.map((kind) => (
            <DocPickRow
              key={kind}
              kind={kind}
              file={files[kind]}
              onPick={(f) => setFiles((s) => ({ ...s, [kind]: f }))}
            />
=======
          <p className="text-xs text-muted-foreground">Загрузите чёткие фото или PDF каждого документа. JPG, PNG или PDF до 10 МБ.</p>
          {DOC_ORDER.map((kind) => (
            <DocPickRow key={kind} kind={kind} file={files[kind]} onPick={(f) => setFiles((s) => ({ ...s, [kind]: f }))} />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
          ))}
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Отправить заявку
        </Button>
      </form>
    </Card>
  );
}

<<<<<<< HEAD
function Row({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        maxLength={60}
      />
=======
function Row({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} maxLength={60} />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

<<<<<<< HEAD
function DocPickRow({
  kind,
  file,
  onPick,
}: {
  kind: DocKind;
  file?: File;
  onPick: (f: File) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
=======
function DocPickRow({ kind, file, onPick }: { kind: DocKind; file?: File; onPick: (f: File) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return; }
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{DOC_LABELS[kind]}</div>
<<<<<<< HEAD
            <div className="truncate text-xs text-muted-foreground">
              {file ? file.name : "Файл не выбран"}
            </div>
=======
            <div className="truncate text-xs text-muted-foreground">{file ? file.name : "Файл не выбран"}</div>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <label className="cursor-pointer">
            <Upload className="mr-1 h-4 w-4" /> {file ? "Заменить" : "Выбрать"}
<<<<<<< HEAD
            <input
              type="file"
              className="hidden"
              accept={ACCEPT}
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
            />
=======
            <input type="file" className="hidden" accept={ACCEPT} capture="environment"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
          </label>
        </Button>
      </div>
      {preview && (
        <div className="mt-3">
<<<<<<< HEAD
          <img
            src={preview}
            alt={DOC_LABELS[kind]}
            className="max-h-48 w-full rounded-md border border-border object-contain"
          />
=======
          <img src={preview} alt={DOC_LABELS[kind]} className="max-h-48 w-full rounded-md border border-border object-contain" />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        </div>
      )}
      {file && !preview && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="h-4 w-4" /> PDF-файл выбран — превью недоступно
        </div>
      )}
    </div>
  );
}

<<<<<<< HEAD
function DocReuploadRow({
  kind,
  doc,
  disabled,
  onPick,
}: {
  kind: DocKind;
  doc?: DocRow;
  disabled?: boolean;
  onPick: (f: File) => void;
}) {
  const statusIcon =
    doc?.status === "approved" ? (
      <CheckCircle2 className="h-4 w-4 text-success" />
    ) : doc?.status === "rejected" ? (
      <XCircle className="h-4 w-4 text-destructive" />
    ) : (
      <Clock className="h-4 w-4 text-muted-foreground" />
    );
=======
function DocReuploadRow({ kind, doc, disabled, onPick }: { kind: DocKind; doc?: DocRow; disabled?: boolean; onPick: (f: File) => void }) {
  const statusIcon = doc?.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-success" />
                  : doc?.status === "rejected" ? <XCircle className="h-4 w-4 text-destructive" />
                  : <Clock className="h-4 w-4 text-muted-foreground" />;
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  const canReupload = !doc || doc.status === "rejected";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {statusIcon}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{DOC_LABELS[kind]}</div>
            <div className="text-xs text-muted-foreground">
<<<<<<< HEAD
              {doc?.status === "approved"
                ? "Одобрено"
                : doc?.status === "rejected"
                  ? "Отклонено"
                  : "На проверке"}
=======
              {doc?.status === "approved" ? "Одобрено" : doc?.status === "rejected" ? "Отклонено" : "На проверке"}
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
            </div>
          </div>
        </div>
        {canReupload && (
          <Button asChild variant="outline" size="sm" disabled={disabled}>
            <label className="cursor-pointer">
              <Upload className="mr-1 h-4 w-4" /> Загрузить
<<<<<<< HEAD
              <input
                type="file"
                className="hidden"
                accept={ACCEPT}
                capture="environment"
                disabled={disabled}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPick(f);
                }}
              />
=======
              <input type="file" className="hidden" accept={ACCEPT} capture="environment" disabled={disabled}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
            </label>
          </Button>
        )}
      </div>
      {doc?.comment && doc.status === "rejected" && (
        <p className="mt-2 text-xs text-destructive">Причина: {doc.comment}</p>
      )}
    </div>
  );
}
