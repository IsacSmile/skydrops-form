import type { Metadata, Viewport } from "next";
import { plusJakartaSans } from "@/lib/fonts";
import { brand } from "@/lib/brand";
import { BrandFooter } from "@/components/public/brand-footer";
import "@/components/public/sk-form.css";

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
    /*
     * Font bug fix:
     * Next/font's variable `--font-jakarta` is only exposed when `plusJakartaSans.variable`
     * is in the className. We attach both `plusJakartaSans.variable` and `plusJakartaSans.className`
     * here on the `.sk-form` ancestor so all children inherit the font variable and class.
     */
    <div
      className={`${plusJakartaSans.variable} ${plusJakartaSans.className} sk-form min-h-screen antialiased flex flex-col justify-between`}
      style={{ backgroundColor: brand.page }}
    >
      <div className="w-full max-w-160 mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-10 flex-1 flex flex-col justify-between">
        <main className="flex-1 flex flex-col">{children}</main>
        <BrandFooter />
      </div>
    </div>
  );
}
