import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isDriver } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setProfile(data));
  }, [user]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const full_name = String(fd.get("full_name") ?? "").trim().slice(0, 100);
    const phone = String(fd.get("phone") ?? "").trim().slice(0, 20);
    try {
      setBusy(true);
      const { error } = await supabase.from("profiles").update({ full_name, phone }).eq("id", user.id);
      if (error) throw error;
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  if (!profile) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h1 className="text-lg font-semibold">Profile</h1>
        <form onSubmit={save} className="mt-4 space-y-3">
          <div className="space-y-1"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div className="space-y-1"><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} maxLength={100} /></div>
          <div className="space-y-1"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" defaultValue={profile.phone ?? ""} maxLength={20} /></div>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </form>
      </Card>

      {!isDriver && (
        <Card className="p-5">
          <h2 className="font-semibold">Want to drive?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add vehicle details and start earning.</p>
          <Button asChild className="mt-3"><Link to="/become-driver">Apply as driver</Link></Button>
        </Card>
      )}
    </div>
  );
}
