import { createFileRoute, Link } from "@tanstack/react-router";
import { Cog, BatteryCharging, CircleDot, Disc3, Zap, HelpCircle, ShieldCheck, Link2, ArrowRight } from "lucide-react";
import hero from "@/assets/hero-workshop.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AutoHelp Lesotho — Car trouble? Find a trusted mechanic" },
      { name: "description", content: "Find verified mechanics in Maseru, Teyateyaneng, Maputsoe and across Lesotho. Every job is recorded on a tamper-proof ledger." },
      { property: "og:title", content: "AutoHelp Lesotho — Find a trusted mechanic" },
      { property: "og:description", content: "Verified local mechanics across Lesotho, with tamper-proof job records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const cats = [
  { label: "Engine", icon: Cog },
  { label: "Battery", icon: BatteryCharging },
  { label: "Tyre", icon: CircleDot },
  { label: "Brakes", icon: Disc3 },
  { label: "Electrical", icon: Zap },
  { label: "Other", icon: HelpCircle },
];

function Index() {
  return (
    <div>
      <section className="relative isolate overflow-hidden">
        <img src={hero} alt="Mosotho mechanic working on a bakkie at dusk" width={1280} height={1600} className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-hero" />
        <div className="mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 pb-14 pt-32">
          <span className="glass mb-4 w-fit rounded-full px-3 py-1 text-xs font-medium">🇱🇸 Maseru · Leribe · Berea · Mafeteng · Mohale's Hoek</span>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.05] md:text-6xl">
            Car trouble? <br />
            <span className="text-gradient">Find a trusted mechanic.</span>
          </h1>
          <p className="mt-4 max-w-lg text-muted-foreground md:text-lg">
            Verified local mechanics, a simple request, and tamper-evident job proofs.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="xl"><Link to="/mechanics">Get started <ArrowRight /></Link></Button>
            <Button asChild variant="glass" size="xl"><Link to="/ledger">See the ledger</Link></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-xl font-bold">What's wrong with your car?</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
          {cats.map(({ label, icon: Icon }) => (
            <Link key={label} to="/mechanics" search={{ category: label }} className="glass flex flex-col items-center gap-2 rounded-2xl p-4 text-sm font-medium transition hover:border-primary/60">
              <Icon className="size-7 text-primary" />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-14 md:grid-cols-3">
        {[
          { icon: ShieldCheck, t: "Verified mechanics", d: "Every workshop is checked by an AutoHelp administrator before it appears." },
          { icon: Link2, t: "Tamper-evident records", d: "Mechanic verifications and job updates have salted fingerprints on a chained ledger." },
          { icon: Cog, t: "No fuss", d: "No maps, no payments, no long forms — describe the problem and get help." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="glass rounded-2xl p-5">
            <Icon className="size-6 text-primary" />
            <h3 className="mt-3 font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
