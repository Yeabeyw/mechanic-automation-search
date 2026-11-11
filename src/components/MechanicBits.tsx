import { Link } from "@tanstack/react-router";
import { BadgeCheck, Star, MapPin } from "lucide-react";
import { photoFor, initials, type Mechanic } from "@/lib/mechanics";
import { cn } from "@/lib/utils";

export function MechanicAvatar({ m, className }: { m: Mechanic; className?: string }) {
  const src = photoFor(m);
  return src ? (
    <img src={src} alt={m.name} loading="lazy" width={816} height={816} className={cn("rounded-2xl object-cover", className)} />
  ) : (
    <div className={cn("grid place-items-center rounded-2xl bg-gradient-primary font-display font-bold text-primary-foreground", className)}>
      {initials(m.name)}
    </div>
  );
}

export function DemoTag() {
  return (
    <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
      Demo
    </span>
  );
}

export function MechanicCard({
  m,
  specialtyMayNotMatch = false,
  aiScore,
}: {
  m: Mechanic;
  specialtyMayNotMatch?: boolean;
  aiScore?: number;
}) {
  return (
    <Link
      to="/mechanics/$id"
      params={{ id: m.id }}
      className="glass group flex gap-4 rounded-2xl p-4 transition hover:-translate-y-0.5 hover:border-primary/50"
    >
      <MechanicAvatar m={m} className="size-20 shrink-0 text-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold">{m.name}</h3>
          {m.verified && <BadgeCheck className="size-4 shrink-0 text-primary" />}
          {m.is_demo && <DemoTag />}
          {aiScore !== undefined && (
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {aiScore.toFixed(0)}% Match
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">{m.workshop}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" /> {m.town}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold"><Star className="size-3 fill-warning text-warning" />{Number(m.rating).toFixed(1)}</span>
          <span className="text-muted-foreground">· {m.jobs_completed} jobs · {m.experience_years} yrs</span>
          <span className={cn("ml-auto rounded-full px-2 py-0.5 font-medium", m.available ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
            {m.available ? "Available now" : "Busy"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {m.specialties.map((s) => (
            <span key={s} className="rounded-md bg-accent px-2 py-0.5 text-[11px]">{s}</span>
          ))}
        </div>
        {specialtyMayNotMatch && (
          <p className="mt-2 text-xs text-warning">Specialty may not match your selected problem.</p>
        )}
      </div>
    </Link>
  );
}
