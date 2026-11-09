export type RequestStatus =
  | "sent"
  | "accepted"
  | "declined"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Mechanic = {
  id: string;
  available: boolean;
  bio: string | null;
  code: string;
  created_at: string;
  experience_years: number;
  is_demo: boolean;
  jobs_completed: number;
  name: string;
  photo_key: string | null;
  rating: number;
  specialties: string[];
  town: string;
  verified: boolean;
  workshop: string;
};

export type ServiceRequest = {
  id: string;
  category: string;
  contact_phone: string | null;
  created_at: string;
  customer_id: string;
  description: string;
  mechanic_id: string;
  mechanic_owner_id: string;
  ref: string;
  status: RequestStatus;
  updated_at: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
};

export type Review = {
  id: string;
  comment: string;
  created_at: string;
  customer_id?: string;
  mechanic_id: string;
  rating: number;
  request_id?: string;
};

const photos: Record<string, string> = {
  thabo,
  lineo,
  neo,
};

export const photoFor = (mechanic: Pick<Mechanic, "photo_key">) =>
  mechanic.photo_key ? photos[mechanic.photo_key] : undefined;

export const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
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
import thabo from "@/assets/mech-thabo.jpg";
import lineo from "@/assets/mech-lineo.jpg";
import neo from "@/assets/mech-neo.jpg";
