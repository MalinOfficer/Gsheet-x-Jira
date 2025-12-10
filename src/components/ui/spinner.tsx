
import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Spinner({ className, style }: SpinnerProps) {
  return (
    <div className={cn("spinner", className)} style={style}>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  );
}
