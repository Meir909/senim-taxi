import { Star } from "lucide-react";
import { useState } from "react";

export function StarRating({
  value,
  onChange,
  size = 32,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          onClick={() => !readOnly && onChange?.(n)}
          className={`transition-transform ${readOnly ? "cursor-default" : "hover:scale-110 active:scale-95"}`}
          aria-label={`${n} звёзд`}
          aria-checked={value === n}
          role="radio"
        >
          <Star
            style={{ width: size, height: size }}
            className={n <= active ? "fill-warning text-warning" : "text-muted-foreground/40"}
          />
        </button>
      ))}
    </div>
  );
}
