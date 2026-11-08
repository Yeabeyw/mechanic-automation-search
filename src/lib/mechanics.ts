import thabo from "@/assets/mech-thabo.jpg";
import lineo from "@/assets/mech-lineo.jpg";
import neo from "@/assets/mech-neo.jpg";
import type { Database } from "@/integrations/supabase/types";

export type Mechanic = Database["public"]["Tables"]["mechanics"]["Row"];
export type ServiceRequest = Database["public"]["Tables"]["service_requests"]["Row"];
export type RequestStatus = Database["public"]["Enums"]["request_status"];

const photos: Record<string, string> = { thabo, lineo, neo };
export const photoFor = (m: Pick<Mechanic, "photo_key">) => (m.photo_key ? photos[m.photo_key] : undefined);
export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

export const CATEGORIES = ["Engine", "Battery", "Tyre", "Brakes", "Electrical", "Other"] as const;

export const STATUS_STEPS: RequestStatus[] = ["sent", "accepted", "in_progress", "completed"];
export const STATUS_LABEL: Record<RequestStatus, string> = {
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
