import { ShieldX, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="glass rounded-3xl p-8">
        <div className="p-4 bg-red-100 dark:bg-red-900 rounded-full mx-auto mb-6 w-fit">
          <ShieldX className="text-red-600 dark:text-red-400" size={48} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">
          {message || "You don't have permission to access this resource."}
        </p>
        <Button asChild variant="hero" size="xl" className="w-full">
          <Link to="/">
            <Home size={18} className="mr-2" />
            Return to home
          </Link>
        </Button>
      </div>
    </div>
  );
}
