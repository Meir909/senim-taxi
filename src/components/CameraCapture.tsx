import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, AlertCircle, SwitchCamera } from "lucide-react";

type Props = {
<<<<<<< HEAD
  facing?: "user" | "environment";
  label?: string;
  onCapture: (dataUrl: string) => void;
  busy?: boolean;
};

=======
  /** "user" = front (selfie), "environment" = back (documents) */
  facing?: "user" | "environment";
  label?: string;
  /** Called when user confirms the captured image. Receives JPEG data URL ~600px. */
  onCapture: (dataUrl: string) => void;
  /** Optional disabled state while parent saves. */
  busy?: boolean;
};

/**
 * Camera-only capture component. Uses navigator.mediaDevices.getUserMedia.
 * No file input fallback — gallery uploads are explicitly NOT allowed.
 * User can retake before confirming.
 */
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
export function CameraCapture({ facing = "user", label, onCapture, busy }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activeFacing, setActiveFacing] = useState<"user" | "environment">(facing);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

<<<<<<< HEAD
  const start = useCallback(
    async (mode: "user" | "environment") => {
      setError(null);
      setReady(false);
      setSnapshot(null);
      stop();
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Камера недоступна в этом браузере");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Нет доступа к камере. Разрешите доступ в настройках браузера."
            : "Не удалось включить камеру",
        );
      }
    },
    [stop],
  );
=======
  const start = useCallback(async (mode: "user" | "environment") => {
    setError(null);
    setReady(false);
    setSnapshot(null);
    stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Камера недоступна в этом браузере");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setReady(true);
      }
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Нет доступа к камере. Разрешите доступ в настройках браузера."
          : "Не удалось включить камеру",
      );
    }
  }, [stop]);
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231

  useEffect(() => {
    void start(activeFacing);
    return () => stop();
  }, [start, stop, activeFacing]);

  function take() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const targetW = 720;
    const scale = targetW / v.videoWidth;
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
<<<<<<< HEAD
=======
    // Mirror the front camera for a natural selfie preview
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    if (activeFacing === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, w, h);
    const url = canvas.toDataURL("image/jpeg", 0.85);
    setSnapshot(url);
    stop();
  }

  function retake() {
    setSnapshot(null);
    void start(activeFacing);
  }

  function confirm() {
    if (snapshot) onCapture(snapshot);
  }

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-medium">{label}</p>}
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted">
        {error ? (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            <div className="space-y-2">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void start(activeFacing)}>
                Попробовать снова
              </Button>
            </div>
          </div>
        ) : snapshot ? (
<<<<<<< HEAD
          <img
            src={snapshot}
            alt="Снимок"
            className="absolute inset-0 h-full w-full object-cover"
          />
=======
          <img src={snapshot} alt="Снимок" className="absolute inset-0 h-full w-full object-cover" />
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 h-full w-full object-cover ${activeFacing === "user" ? "scale-x-[-1]" : ""}`}
            />
            {!ready && (
              <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                Включаем камеру…
              </div>
            )}
            <button
              type="button"
              onClick={() => setActiveFacing((m) => (m === "user" ? "environment" : "user"))}
              className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-background/80 backdrop-blur"
              aria-label="Сменить камеру"
            >
              <SwitchCamera className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div className="flex gap-2">
        {snapshot ? (
          <>
<<<<<<< HEAD
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={retake}
              disabled={busy}
            >
=======
            <Button type="button" variant="outline" className="flex-1" onClick={retake} disabled={busy}>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
              <RotateCcw className="mr-2 h-4 w-4" /> Переснять
            </Button>
            <Button type="button" className="flex-1" onClick={confirm} disabled={busy}>
              <Check className="mr-2 h-4 w-4" /> Использовать
            </Button>
          </>
        ) : (
          <Button type="button" className="flex-1" onClick={take} disabled={!ready || busy}>
            <Camera className="mr-2 h-4 w-4" /> Сделать снимок
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Загрузка из галереи запрещена — только живая камера.
      </p>
    </div>
  );
}
