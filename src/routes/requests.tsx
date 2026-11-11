import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Star, Check } from "lucide-react";
import {
  cancelServiceRequest,
  getCustomerRequests,
  listVerifiedMechanics,
  reassignServiceRequest,
  submitReview,
} from "@/lib/firebase-data";
import { useAuth } from "@/lib/auth";
import { STATUS_LABEL, STATUS_STEPS, type RequestStatus } from "@/lib/mechanics";
import { LedgerProof } from "@/components/LedgerProof";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/requests")({
  head: () => ({
    meta: [
      { title: "My requests — AutoHelp Lesotho" },
      {
        name: "description",
        content: "Track your repair requests, status timeline and leave reviews.",
      },
      { property: "og:title", content: "My requests — AutoHelp Lesotho" },
      { property: "og:description", content: "Track repair requests and review completed jobs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyRequests,
});

function MyRequests() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-requests", user?.uid],
    enabled: !!user,
    queryFn: () => getCustomerRequests(user!.uid),
  });
  const { data: availableMechanics } = useQuery({
    queryKey: ["mechanics"],
    queryFn: listVerifiedMechanics,
  });
  const [reassigning, setReassigning] = useState<string | null>(null);

  if (!loading && !user)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Your requests</h1>
        <p className="mt-2 text-muted-foreground">Sign in to see and track your requests.</p>
        <Button asChild variant="hero" size="xl" className="mt-6">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );

  async function cancel(id: string) {
    try {
      await cancelServiceRequest(id);
      toast.success("Request cancelled");
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["ledger-ref"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel this request.");
    }
  }

  async function chooseMechanic(requestId: string, mechanicId: string) {
    if (!mechanicId) return;
    setReassigning(requestId);
    try {
      await reassignServiceRequest(requestId, mechanicId);
      toast.success("Your request was sent to the selected mechanic.");
      await qc.invalidateQueries({ queryKey: ["my-requests"] });
      await qc.invalidateQueries({ queryKey: ["mechanics"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not choose another mechanic.");
    } finally {
      setReassigning(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">My requests</h1>
      <div className="mt-6 space-y-4">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {data?.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-muted-foreground">No requests yet.</p>
            <Button asChild variant="hero" className="mt-4">
              <Link to="/mechanics">Find a mechanic</Link>
            </Button>
          </div>
        )}
        {data?.map((r) => (
          <div key={r.id} className="glass space-y-4 rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{r.ref}</p>
                <h2 className="text-lg font-semibold">
                  {r.category} · {r.vehicle_make} {r.vehicle_model} {r.vehicle_year ?? ""}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {r.mechanics
                    ? `${r.mechanics.name} — ${r.mechanics.workshop}, ${r.mechanics.town}`
                    : r.returned_to_pool
                      ? "Waiting in the verified mechanic pool"
                      : "Mechanic details unavailable"}
                </p>
              </div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">
                {STATUS_LABEL[r.status]}
              </span>
            </div>
            <Timeline status={r.status} />
            {r.returned_to_pool && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                <p className="text-sm font-medium">
                  A mechanic declined. Your request is back in the pool.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You can wait for another verified, available mechanic or choose one directly.
                </p>
                <label className="mt-3 block text-sm">
                  Choose another mechanic
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                    defaultValue=""
                    disabled={reassigning === r.id}
                    onChange={(event) => void chooseMechanic(r.id, event.target.value)}
                    aria-label={`Choose a new mechanic for request ${r.ref}`}
                  >
                    <option value="">Select a verified available mechanic</option>
                    {(availableMechanics ?? [])
                      .filter(
                        (mechanic) =>
                          mechanic.id !== r.mechanic_id &&
                          !r.status_history?.some(
                            (event) =>
                              event.status === "declined" && event.mechanic_id === mechanic.id,
                          ),
                      )
                      .map((mechanic) => (
                        <option key={mechanic.id} value={mechanic.id}>
                          {mechanic.name} · {mechanic.town}
                          {!mechanic.specialties.includes(r.category)
                            ? " · Specialty may not match"
                            : ""}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            )}
            {!!r.status_history?.length && (
              <ol
                className="space-y-1 text-xs text-muted-foreground"
                aria-label="Request event history"
              >
                {r.status_history.map((event, index) => (
                  <li key={`${event.changed_at}-${index}`}>
                    {STATUS_LABEL[event.status]} ·{" "}
                    {new Date(event.changed_at).toLocaleString("en-ZA", {
                      timeZone: "Africa/Maseru",
                    })}
                    {event.note ? ` — ${event.note}` : ""}
                  </li>
                ))}
              </ol>
            )}
            <p className="text-sm">{r.description}</p>
            <LedgerProof
              recordRef={r.ref}
              snapshot={{
                type: "service_request",
                ref: r.ref,
                category: r.category,
                mechanicCode: r.mechanics?.code ?? null,
                status: r.status,
                vehicleMake: r.vehicle_make,
                vehicleModel: r.vehicle_model,
                vehicleYear: r.vehicle_year,
                description: r.description,
                contactPhone: r.contact_phone,
              }}
            />
            <div className="flex flex-wrap gap-2">
              {r.status === "sent" && (
                <Button variant="glass" size="sm" onClick={() => cancel(r.id)}>
                  Cancel request
                </Button>
              )}
            </div>
            {r.status === "completed" && !r.reviews && (
              <ReviewForm requestId={r.id} mechanicId={r.mechanic_id} />
            )}
            {r.status === "completed" && !!r.reviews && (
              <p className="text-sm text-success">✓ Thanks — your review is recorded.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({ status }: { status: RequestStatus }) {
  if (status === "cancelled" || status === "declined")
    return <p className="text-sm text-destructive">This request was {status}.</p>;
  const idx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center">
      {STATUS_STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full border text-xs",
                i <= idx
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {i <= idx ? <Check className="size-4" /> : i + 1}
            </span>
            <span className="text-[11px] text-muted-foreground">{STATUS_LABEL[s]}</span>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={cn("mx-1 mb-5 h-0.5 flex-1", i < idx ? "bg-primary" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}

function ReviewForm({ requestId, mechanicId }: { requestId: string; mechanicId: string }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  async function submit() {
    try {
      await submitReview({
        request_id: requestId,
        mechanic_id: mechanicId,
        rating,
        comment: comment.slice(0, 400),
      });
      toast.success("Review submitted and recorded in the Firebase ledger");
      qc.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your review.");
    }
  }
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="font-semibold">How did it go?</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
            <Star
              className={cn(
                "size-7",
                n <= rating ? "fill-warning text-warning" : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
      <Textarea
        className="mt-3"
        rows={3}
        maxLength={400}
        placeholder="Short review"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button variant="hero" className="mt-3" onClick={submit}>
        Submit review
      </Button>
    </div>
  );
}
