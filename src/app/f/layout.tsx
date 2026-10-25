import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { brand } from "@/lib/brand";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: {
    default: brand.name,
    template: `%s | ${brand.name}`,
  },
  description: brand.tagline,
};

export default function PublicFormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${plusJakartaSans.className} min-h-screen antialiased`}
      style={
        {
          colorScheme: "light",
          "--background": brand.background,
          "--foreground": brand.foreground,
          "--card": brand.card,
          "--card-foreground": brand.foreground,
          "--popover": brand.card,
          "--popover-foreground": brand.foreground,
          "--primary": brand.primary,
          "--primary-foreground": brand.primaryForeground,
          "--ring": brand.ring,
          "--border": brand.border,
          "--input": brand.border,
          "--muted-foreground": brand.muted,
          "--destructive": brand.danger,
          "--radius": brand.radius,
          backgroundColor: brand.background,
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(31, 161, 255, 0.12) 0%, transparent 65%)",
          backgroundRepeat: "no-repeat",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
