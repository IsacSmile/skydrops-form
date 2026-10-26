/**
 * Brand Design Tokens & Assets for Skydrops
 * Single source of truth for public-facing pages.
 *
 * NOTE: The gradient is DECORATIVE ONLY. Never put white text on it,
 * because white on #1FA1FF fails WCAG contrast; white on #0B5BFF passes AA (~5.3:1).
 */
export const brand = {
  name: "Skydrops",
  tagline: "Sustainable Water Technologies",
  primary: "#0B5BFF",
  primaryHover: "#0A4FDB",
  primaryForeground: "#FFFFFF",
  sky: "#1FA1FF",
  gradient: "linear-gradient(135deg, #1FA1FF 0%, #0B5BFF 100%)",
  foreground: "#111014",
  muted: "#5B6475",
  border: "#DCE6F5",
  background: "#F4F8FF",
  card: "#FFFFFF",
  ring: "rgba(11, 91, 255, 0.35)",
  danger: "#D92D20",
  radius: "16px",
  logo: {
    lockup: "/brand/skydrops-logo-lockup.png",
    lockupSize: [1000, 726] as const,
    mark: "/brand/skydrops-mark.png",
    markSize: [512, 714] as const,
  },
  parentBrands: [
    {
      name: "Skydrops Water",
      href: "https://skydropswater.com/",
      display: "skydropswater.com",
      logo: "/brand/skydrops-water-logo.png",
      logoWidth: 410,
      logoHeight: 109,
    },
    {
      name: "Skydrops Technologies",
      href: "https://www.skydropstechnologies.com/",
      display: "skydropstechnologies.com",
      logo: "/brand/skydrops-tech-logo.png",
      logoWidth: 569,
      logoHeight: 471,
    },
  ] as const,
} as const;

export type Brand = typeof brand;
