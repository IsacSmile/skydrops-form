import { Plus_Jakarta_Sans } from "next/font/google";

/**
 * Brand Font: Plus Jakarta Sans
 * Configured with required weights, display: swap, and CSS variable --font-jakarta.
 * Exported so both the public layout (/f/*) and the admin form-preview wrapper
 * inherit the exact same font class and variable.
 */
export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});
