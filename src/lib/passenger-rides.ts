import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Ride = Database["public"]["Tables"]["rides"]["Row"];
export type Driver = Database["public"]["Tables"]["drivers"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Loc = Database["public"]["Tables"]["driver_locations"]["Row"];

const passengerRideSnapshots = new Map<string, Ride>();

export const WAITING_STATUSES: ReadonlyArray<Ride["status"]> = [
  "accepted",
  "driver_arriving",
  "driver_arrived",
];

export const SEARCHING_STATUSES: ReadonlyArray<Ride["status"]> = ["requested", "searching"];

export const STATUS_LABEL: Record<Ride["status"], string> = {
  requested: "Создаём заказ…",
  searching: "Ищем водителя…",
  accepted: "Водитель назначен",
  driver_arriving: "Водитель в пути",
  driver_arrived: "Водитель прибыл",
  in_progress: "В пути",
  completed: "Завершено",
  cancelled: "Отменено",
  no_drivers: "Нет свободных водителей",
};

export function isWaitingStatus(status: Ride["status"]): boolean {
  return WAITING_STATUSES.includes(status);
}

export function isSearchingStatus(status: Ride["status"]): boolean {
  return SEARCHING_STATUSES.includes(status);
}

export function primePassengerRideSnapshot(ride: Ride | null) {
  if (!ride) return;
  passengerRideSnapshots.set(ride.id, ride);
}

export function getPassengerRideSnapshot(rideId: string): Ride | null {
  return passengerRideSnapshots.get(rideId) ?? null;
}

export function clearPassengerRideSnapshot(rideId?: string) {
  if (rideId) {
    passengerRideSnapshots.delete(rideId);
    return;
  }
  passengerRideSnapshots.clear();
}

export function fmtElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function cancelPassengerRide(rideId: string, passengerId: string) {
  return supabase
    .from("rides")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "passenger_cancelled",
    })
    .eq("id", rideId)
    .eq("passenger_id", passengerId);
}
