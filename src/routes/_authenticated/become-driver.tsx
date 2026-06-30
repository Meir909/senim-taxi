import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/become-driver")({
  component: BecomeDriver,
});

const txt = (max = 60) => z.string().trim().min(1, "Required").max(max);

function BecomeDriver() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    try {
      const payload = {
        vehicle_make: txt().parse(fd.get("vehicle_make")),
        vehicle_model: txt().parse(fd.get("vehicle_model")),
        vehicle_plate: txt(15).parse(fd.get("vehicle_plate")),
        vehicle_color: txt(30).parse(fd.get("vehicle_color")),
        license_number: txt(30).parse(fd.get("license_number")),
      };
      setBusy(true);
      // 1. grant driver role (idempotent via unique constraint)
      const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" });
      if (roleErr && !/duplicate/i.test(roleErr.message)) throw roleErr;
      // 2. upsert drivers row
      const { error } = await supabase.from("drivers").upsert({
        id: user.id, ...payload, status: "offline",
      });
      if (error) throw error;
      toast.success("Application submitted. Awaiting approval.");
      // refresh roles by full reload (simplest)
      window.location.assign("/driver");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold">Driver application</h1>
      <p className="mt-1 text-sm text-muted-foreground">Submit your vehicle details. Approval happens manually in MVP.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Row label="Make" name="vehicle_make" placeholder="Toyota" />
        <Row label="Model" name="vehicle_model" placeholder="Camry" />
        <Row label="Plate" name="vehicle_plate" placeholder="A123 BC" />
        <Row label="Color" name="vehicle_color" placeholder="White" />
        <Row label="License #" name="license_number" placeholder="DL-99887766" />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void navigate({ to: "/home" })}>Cancel</Button>
      </form>
    </Card>
  );
}

function Row({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} placeholder={placeholder} required />
    </div>
  );
}
