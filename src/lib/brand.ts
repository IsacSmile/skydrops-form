/**
 * Brand Design Tokens & Assets for Skydrops (U3 Light & Airy)
 * Single source of truth for public-facing pages.
 */
export const brand = {
  name: "Skydrops",
  tagline: "Sustainable Water Technologies",

  // Core Brand Tokens (U3 Palette)
  ink: "#0B1B4A", // titles, labels, input text
  textSoft: "#2B3A5C", // header description
  muted: "#5B6475", // secondary text & captions
  placeholder: "#7B879B",
  icon: "#5F6F8F",
  iconStrong: "#34456B",
  border: "#C9D6EA",
  borderHover: "#A9BAD6",
  cardBorder: "#E3EAF5",
  divider: "#E6ECF5",
  primary: "#0B5BFF",
  primaryHover: "#0A4FDB",
  primarySoft: "#F2F7FF",
  primaryRing: "rgba(11, 91, 255, 0.16)",
  page: "#F4F7FB",
  surface: "#FFFFFF",

  // Feedback & Status Tokens
  danger: "#D92D20",
  dangerSoft: "#FEF3F2",
  dangerBorder: "#FECDCA",
  dangerText: "#B42318",
  success: "#12B76A",
  successSoft: "#ECFDF3",

  // Legacy mappings for backward compatibility
  navy900: "#071642",
  navy800: "#08184C",
  navy700: "#0A2A8A",
  sky: "#1FA1FF",
  text: "#0B1B4A",
  foreground: "#0B1B4A",
  background: "#F4F7FB",
  card: "#FFFFFF",
  ring: "rgba(11, 91, 255, 0.16)",

  // Radii
  radii: {
    card: "12px",
    control: "8px",
    linkCard: "12px",
    chip: "6px",
    checkbox: "4px",
    radio: "9999px",
  },
  radius: "8px",

  // Shadows
  shadows: {
    card: "0 1px 2px rgba(8, 24, 76, 0.05), 0 12px 32px -14px rgba(8, 24, 76, 0.14)",
    button: "0 6px 16px -6px rgba(11, 91, 255, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
    linkCard: "0 1px 2px rgba(8, 24, 76, 0.04)",
    popover: "0 12px 32px -8px rgba(8, 24, 76, 0.18)",
  },

  // Assets
  logo: {
    horizontal: "/brand/skydrops-logo-horizontal.png",
    horizontalSize: [1400, 429] as const,
    headerBackground: "/brand/header-background-image.png",
    markWhite: "/brand/skydrops-mark-white.png",
    markWhiteSize: [600, 836] as const,
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
  },

  /*
   * The reference design labelled the second card 'Skydrops Product website'.
   * We use the verified brand name 'Skydrops Water'. Change `label` here to switch.
   */
  parentBrands: [
    {
      key: "technologies",
      name: "Skydrops Technologies",
      label: "Skydrops Technologies website",
      href: "https://www.skydropstechnologies.com/",
      logo: "/brand/skydrops-tech-logo.png",
      logoWidth: 569,
      logoHeight: 471,
    },
    {
      key: "water",
      name: "Skydrops Water",
      label: "Skydrops Water website",
      href: "https://skydropswater.com/",
      logo: "/brand/Product%20Logo%20(Royal%20Navy%20Blue).png",
      logoWidth: 532,
      logoHeight: 126,
    },
  ] as const,
} as const;

export type Brand = typeof brand;
