import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createServiceRequest, getMechanic } from "@/lib/firebase-data";
import { useAuth } from "@/lib/auth";
import { CATEGORIES } from "@/lib/mechanics";
import { MechanicAvatar } from "@/components/MechanicBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/request/$mechanicId")({
  head: () => ({
    meta: [
      { title: "Request help — AutoHelp Lesotho" },
      { name: "description", content: "Send a short repair request to a verified mechanic." },
      { property: "og:title", content: "Request help — AutoHelp Lesotho" },
      { property: "og:description", content: "Describe your car problem and send it to a mechanic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestHelp,
});

function RequestHelp() {
  const { mechanicId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>("Engine");
  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [phone, setPhone] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: m } = useQuery({
    queryKey: ["mechanic", mechanicId],
    queryFn: () => getMechanic(mechanicId),
  });

  if (!loading && !user)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Sign in to request help</h1>
        <p className="mt-2 text-muted-foreground">We need an account so the mechanic can reach you and you can track the job.</p>
        <Button asChild variant="hero" size="xl" className="mt-6"><Link to="/auth">Sign in or create account</Link></Button>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (model.trim().length < 1 || desc.trim().length < 5) { toast.error("Add your car model and a short description."); return; }
    setBusy(true);
    try {
      await createServiceRequest({
        mechanic_id: mechanicId,
        category,
        vehicle_make: make.trim().slice(0, 40),
        vehicle_model: model.trim().slice(0, 40),
        vehicle_year: year ? Number(year) : null,
        description: desc.trim().slice(0, 500),
        contact_phone: phone.trim().slice(0, 20) || null,
      });
      toast.success("Request sent and recorded in the Firebase ledger.");
      navigate({ to: "/requests" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-3xl font-bold">Request help</h1>
      {m && (
        <div className="glass mt-4 flex items-center gap-3 rounded-2xl p-3">
          <MechanicAvatar m={m} className="size-12 text-sm" />
          <div><p className="font-semibold">{m.name}</p><p className="text-xs text-muted-foreground">{m.workshop} · {m.town}</p></div>
        </div>
      )}
      <form onSubmit={submit} className="glass mt-4 space-y-5 rounded-2xl p-5">
        <div>
          <Label>Problem</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button type="button" key={c} onClick={() => setCategory(c)} className={cn("rounded-xl border px-3 py-2 text-sm", category === c ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{c}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label htmlFor="make">Make</Label><Input id="make" value={make} onChange={(e) => setMake(e.target.value)} className="mt-1" /></div>
          <div><Label htmlFor="model">Model</Label><Input id="model" placeholder="Corolla" value={model} onChange={(e) => setModel(e.target.value)} className="mt-1" /></div>
          <div><Label htmlFor="year">Year</Label><Input id="year" type="number" min={1970} max={2027} placeholder="2012" value={year} onChange={(e) => setYear(e.target.value)} className="mt-1" /></div>
        </div>
        <div>
          <Label htmlFor="desc">What's happening?</Label>
          <Textarea id="desc" maxLength={500} rows={4} placeholder="Car won't start this morning in Ha Thetsane, clicking sound…" value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">Describe the problem clearly so the mechanic can diagnose and bring the right tools.</p>
        </div>
        <div>
          <Label htmlFor="phone">Phone for the mechanic (optional)</Label>
          <Input id="phone" placeholder="+266 5x xxx xxx" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">Include country code for reliable contact.</p>
        </div>
        <p className="text-xs text-muted-foreground">Only the request number, mechanic code, category and status go on the ledger. Your name, phone, car and description stay private.</p>
        <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send request"}</Button>
      </form>
    </div>
  );
}
