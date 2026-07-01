import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PassengerWaitingPage } from "@/components/PassengerWaitingPage";
import { useRideDropoffPin } from "@/hooks/useRideDropoffPin";
import { useRidePickupPin } from "@/hooks/useRidePickupPin";
import { usePassengerRideLive } from "@/hooks/usePassengerRideLive";
import { useAuth } from "@/lib/auth-context";
import { cancelPassengerRide, isWaitingStatus } from "@/lib/passenger-rides";

export const Route = createFileRoute("/_authenticated/passenger/ride/$rideId/waiting")({
  component: WaitingPage,
});

function WaitingPage() {
  const { rideId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const { ride, driver, driverProfile, driverLoc, locError, loading } =
    usePassengerRideLive(rideId);
  const { pin } = useRidePickupPin(rideId, ride?.tariff === "kids");
  const { pin: dropoffPin } = useRideDropoffPin(rideId, ride?.tariff === "kids");

  useEffect(() => {
    if (!ride) return;
    if (!isWaitingStatus(ride.status)) {
      void navigate({
        to: "/passenger/ride/$rideId",
        params: { rideId: ride.id },
        replace: true,
      });
    }
  }, [ride, navigate]);

  async function cancel() {
    if (!ride || !user || cancelling) return;
    setCancelling(true);
    try {
      const { error } = await cancelPassengerRide(ride.id, user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.info("Поездка отменена");
      void navigate({ to: "/passenger", replace: true });
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ride) {
    return <div className="text-center text-muted-foreground">Поездка не найдена.</div>;
  }

  if (!isWaitingStatus(ride.status)) {
    return null;
  }

  return (
    <PassengerWaitingPage
      ride={ride}
      pickupPin={pin}
      dropoffPin={dropoffPin}
      driver={driver}
      driverProfile={driverProfile}
      driverLoc={driverLoc}
      locError={locError}
      cancelling={cancelling}
      onCancel={cancel}
    />
  );
}
