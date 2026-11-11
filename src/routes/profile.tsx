import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  deleteMyAccount,
  exportMyData,
  getMyVehicles,
  recordDataExport,
  updateMyVehicles,
  type Vehicle,
} from "@/lib/firebase-data";
import { isFirebaseMutationsEnabled } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Save, User, Trash2 } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile \u2014 AutoHelp Lesotho" },
      { name: "description", content: "Manage your AutoHelp Lesotho profile." },
    ],
  }),
  component: ProfilePage,
});

// Firebase exposes UserMetadata.creationTime / lastSignInTime as date strings.
function formatDate(value: string | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleDateString("en-ZA", { timeZone: "Africa/Maseru" });
}

function ProfilePage() {
  const { user, updateProfile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.displayName || "");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesBusy, setVehiclesBusy] = useState(false);
  const vehiclesQuery = useQuery({
    queryKey: ["my-vehicles", user?.uid],
    enabled: !!user,
    queryFn: () => getMyVehicles(user!.uid),
  });

  useEffect(() => {
    if (vehiclesQuery.data) setVehicles(vehiclesQuery.data);
  }, [vehiclesQuery.data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    setBusy(true);
    try {
      await updateProfile(name.trim());
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadData() {
    if (!user) return;
    setExporting(true);
    try {
      if (isFirebaseMutationsEnabled()) await recordDataExport();
      // Everything the app holds about this user: account, profile/roles, requests,
      // reviews and (for mechanics) workshop profile, received requests and reviews.
      const held = await exportMyData(user.uid);
      const payload = {
        exportedAt: new Date().toISOString(),
        account: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          createdAt: user.metadata.creationTime ?? null,
          lastSignInAt: user.metadata.lastSignInTime ?? null,
        },
        ...held,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `autohelp-data-${user.uid}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(
        isFirebaseMutationsEnabled()
          ? "Your data has been downloaded and the export was audited."
          : "Your data was downloaded; the read-only backend could not audit this export.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export your data.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!isFirebaseMutationsEnabled()) {
      toast.error("Account deletion is unavailable until the secure Firebase backend is deployed.");
      return;
    }
    if (!window.confirm("Permanently delete your account and personal data? Ledger hashes may remain.")) return;
    setDeleting(true);
    try {
      await deleteMyAccount();
      await signOut();
      toast.success("Your account and personal data were deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete your account.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveVehicles(e: React.FormEvent) {
    e.preventDefault();
    const normalized = vehicles
      .filter((vehicle) => vehicle.make.trim() || vehicle.model.trim())
      .map((vehicle) => ({
        make: vehicle.make.trim(),
        model: vehicle.model.trim(),
        year: vehicle.year,
      }));
    if (normalized.some((vehicle) => !vehicle.make || !vehicle.model)) {
      toast.error("Enter both make and model for each vehicle.");
      return;
    }
    setVehiclesBusy(true);
    try {
      await updateMyVehicles(normalized);
      await queryClient.invalidateQueries({ queryKey: ["my-vehicles", user?.uid] });
      toast.success("Your vehicles were saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your vehicles.");
    } finally {
      setVehiclesBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="glass rounded-3xl p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-gradient-primary rounded-full">
            <User className="text-primary-foreground" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your account settings</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user.email || ""} disabled className="mt-1 bg-muted" />
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
          </div>

          <div>
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="mt-1"
              required
            />
          </div>

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
            <Save size={18} className="mr-2" />
            {busy ? "Saving..." : "Save changes"}
          </Button>
        </form>

        <form onSubmit={handleSaveVehicles} className="mt-8 space-y-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold">My vehicles</h2>
            <p className="text-sm text-muted-foreground">Keep up to five vehicles on your private profile. You can select one when requesting help.</p>
          </div>
          {vehiclesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading vehicles…</p>}
          {vehicles.map((vehicle, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_100px_auto] items-end gap-2">
              <div>
                <Label htmlFor={`vehicle-make-${index}`}>Make</Label>
                <Input id={`vehicle-make-${index}`} maxLength={40} value={vehicle.make} onChange={(event) => setVehicles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, make: event.target.value } : item))} />
              </div>
              <div>
                <Label htmlFor={`vehicle-model-${index}`}>Model</Label>
                <Input id={`vehicle-model-${index}`} maxLength={40} value={vehicle.model} onChange={(event) => setVehicles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, model: event.target.value } : item))} />
              </div>
              <div>
                <Label htmlFor={`vehicle-year-${index}`}>Year</Label>
                <Input id={`vehicle-year-${index}`} type="number" min={1970} max={new Date().getFullYear() + 1} value={vehicle.year ?? ""} onChange={(event) => setVehicles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, year: event.target.value ? Number(event.target.value) : null } : item))} />
              </div>
              <Button type="button" variant="outline" onClick={() => setVehicles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove vehicle ${index + 1}`}>Remove</Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={vehicles.length >= 5} onClick={() => setVehicles((current) => [...current, { make: "", model: "", year: null }])}>Add vehicle</Button>
            <Button type="submit" variant="hero" disabled={vehiclesBusy || !isFirebaseMutationsEnabled()}>{vehiclesBusy ? "Saving…" : "Save vehicles"}</Button>
          </div>
          {!isFirebaseMutationsEnabled() && <p className="text-xs text-warning">Vehicle updates require the protected Cloud Functions backend and are disabled in this free-plan deployment.</p>}
        </form>

        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold mb-4">Data Export</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Download the personal data we hold about you (account, requests, reviews and, for mechanics,
            your workshop profile) in JSON format, as per your GDPR right to data portability.
          </p>
          <Button onClick={handleDownloadData} variant="outline" size="lg" className="w-full" disabled={exporting}>
            <Download size={18} className="mr-2" />
            {exporting ? "Preparing your data..." : "Download my data"}
          </Button>
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <h2 className="mb-2 text-lg font-semibold">Delete my account</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Deletion requires the secure backend and is disabled in read-only mode. Irreversible ledger hashes may remain after deletion.
          </p>
          <Button onClick={handleDeleteAccount} variant="destructive" className="w-full" disabled={deleting || !isFirebaseMutationsEnabled()}>
            <Trash2 size={18} className="mr-2" />
            {deleting ? "Deleting account..." : "Delete my account"}
          </Button>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold mb-4">Account Information</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID:</span>
              <code className="font-mono text-xs">{user.uid}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span>{formatDate(user.metadata.creationTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last sign-in:</span>
              <span>{formatDate(user.metadata.lastSignInTime)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
