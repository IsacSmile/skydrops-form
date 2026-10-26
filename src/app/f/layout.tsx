import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { brand } from "@/lib/brand";
import { BrandFooter } from "@/components/public/brand-footer";
import "@/components/public/sk-form.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: brand.name,
    template: `%s | ${brand.name}`,
  },
  description: brand.tagline,
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function PublicFormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${plusJakartaSans.className} sk-form min-h-screen antialiased flex flex-col justify-between`}
      style={{
        backgroundColor: "#F5F7FB",
        backgroundImage:
          "radial-gradient(900px 420px at 50% -80px, rgba(31, 161, 255, 0.14), transparent 70%)",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="w-full max-w-160 mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-12 flex-1 flex flex-col justify-between">
        <main className="flex-1 flex flex-col">{children}</main>
        <BrandFooter />
      </div>
    </div>
  );
}
