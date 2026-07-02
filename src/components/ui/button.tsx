import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer border",
  {
    variants: {
      variant: {
        // Botão de marca (verde Supabase, texto escuro)
        primary:
          "bg-primary text-primary-foreground border-[#34b87e] hover:bg-[#34d39a]",
        // Botão neutro escuro com borda (estilo "default" do Supabase)
        secondary:
          "bg-[#2a2a2a] text-foreground border-[#3e3e3e] hover:bg-[#323232]",
        ghost: "bg-transparent text-foreground border-transparent hover:bg-muted",
        destructive:
          "bg-[var(--negative)] text-[#1c1c1c] border-transparent hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-10 px-5 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
