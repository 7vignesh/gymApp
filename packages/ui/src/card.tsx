import * as React from "react";
import { cn } from "./cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Disable the subtle hover lift. */
  flat?: boolean;
  /** Glow border variant (emerald/cyan). */
  glow?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, flat, glow, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_10px_30px_-15px_rgba(0,0,0,0.8)]",
        !flat && "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-white/[0.14]",
        glow && "before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:bg-brand-gradient-soft before:blur-xl before:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-5 pt-5 pb-3", className)} {...props} />
);

export const CardBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-5 py-3", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-5 pb-5 pt-3", className)} {...props} />
);
