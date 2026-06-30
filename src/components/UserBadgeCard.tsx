import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getUserAvatarUrl } from "@/lib/signed-url.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, Star } from "lucide-react";

type Props = {
  userId: string;
  name?: string | null;
  rating?: number | null;
  subtitle?: string | null;
  size?: "sm" | "md" | "lg";
};

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
};

/** Shows a user's verification selfie + name + rating. Used by passengers and
 *  drivers to see each other on active rides / offers. */
export function UserBadgeCard({ userId, name, rating, subtitle, size = "md" }: Props) {
  const fetchUrl = useServerFn(getUserAvatarUrl);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void fetchUrl({ data: { userId } }).then((r) => {
      if (mounted) setUrl(r.url);
    });
    return () => { mounted = false; };
  }, [userId, fetchUrl]);

  const initials = (name ?? "?").trim().split(/\s+/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("") || "?";

  return (
    <div className="flex items-center gap-3">
      <Avatar className={SIZE[size]}>
        {url ? <AvatarImage src={url} alt={name ?? "Аватар"} /> : null}
        <AvatarFallback><UserIcon className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
        {!url && initials !== "?" && (
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
        )}
      </Avatar>
      <div className="min-w-0">
        <div className="truncate font-semibold">{name || "Пользователь"}</div>
        {rating != null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            {Number(rating).toFixed(2)}
          </div>
        )}
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}
