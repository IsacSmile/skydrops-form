/**
 * Brand Design Tokens & Assets for Skydrops
 * Single source of truth for public-facing pages.
 *
 * "Deep sky" Design Direction:
 * Restrained, editorial and precise: hairline borders, 8px/12px radii,
 * generous whitespace, confident brand blues.
 */
export const brand = {
  name: "Skydrops",
  tagline: "Sustainable Water Technologies",

  // Core Brand Blues & Navies
  navy900: "#071642",
  navy800: "#08184C",
  navy700: "#0A2A8A",
  primary: "#0B5BFF",
  primaryHover: "#0A4FDB",
  primarySoft: "#F2F7FF",
  primaryRing: "rgba(11, 91, 255, 0.18)",
  primaryForeground: "#FFFFFF",
  sky: "#1FA1FF",

  // Neutral Palette
  ink: "#111014", // headings
  text: "#1B2433", // body text
  muted: "#5B6475", // secondary text & captions
  placeholder: "#8A94A6",
  border: "#D5DEEC",
  borderHover: "#A9BAD6",
  divider: "#E6ECF5",
  surface: "#FFFFFF",
  page: "#F5F7FB",

  // Feedback & Status
  danger: "#D92D20",
  dangerSoft: "#FEF3F2",
  dangerBorder: "#FECDCA",
  dangerText: "#B42318",
  success: "#12B76A",
  successSoft: "#ECFDF3",

  // Legacy mappings for backward compatibility
  foreground: "#111014",
  background: "#F5F7FB",
  card: "#FFFFFF",
  ring: "rgba(11, 91, 255, 0.18)",
  gradient: "linear-gradient(135deg, #071642 0%, #0A2A8A 58%, #0B5BFF 130%)",

  // Strict Radii
  radii: {
    card: "12px",
    control: "8px",
    chip: "6px",
    checkbox: "4px",
    radio: "9999px",
  },
  radius: "8px",

  // Shadows
  shadows: {
    card: "0 1px 2px rgba(8, 24, 76, 0.05), 0 16px 40px -16px rgba(8, 24, 76, 0.18)",
    button: "0 1px 2px rgba(8, 24, 76, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.14)",
    popover: "0 12px 32px -8px rgba(8, 24, 76, 0.18)",
  },

  // Assets
  logo: {
    lockup: "/brand/skydrops-logo-lockup.png",
    lockupSize: [1000, 726] as const,
    lockupWhite: "/brand/skydrops-logo-lockup-white.png",
    lockupWhiteSize: [1000, 726] as const,
    full: "/brand/skydrops-logo-full.png",
    fullSize: [1200, 999] as const,
    fullWhite: "/brand/skydrops-logo-full-white.png",
    fullWhiteSize: [1200, 999] as const,
    mark: "/brand/skydrops-mark.png",
    markSize: [512, 714] as const,
    markWhite: "/brand/skydrops-mark-white.png",
    markWhiteSize: [600, 836] as const,
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
