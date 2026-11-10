import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { exportMyData } from "@/lib/firebase-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Save, User } from "lucide-react";

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
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.displayName || "");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      toast.success("Your data has been downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export your data.");
    } finally {
      setExporting(false);
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
