import Image from "next/image";
import { brand } from "@/lib/brand";

interface FormHeaderBandProps {
  title: string;
  description?: string | null;
  priorityLogo?: boolean;
}

/**
 * Reusable Deep Sky Header Band rendered inside the top of the card.
 * Shared across active form, thank-you, closed, and not-found states.
 */
export function FormHeaderBand({
  title,
  description,
  priorityLogo = true,
}: FormHeaderBandProps) {
  return (
    <div className="sk-header-band relative px-5 pt-7 pb-[26px] sm:px-10 sm:pt-9 sm:pb-8">
      {/* Decorative Layer 1: Soft Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(420px 220px at 88% 0%, rgba(31, 161, 255, 0.38), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Decorative Layer 2: All-White Drop Watermark */}
      <div
        className="absolute -right-7 -bottom-14 pointer-events-none select-none opacity-[0.07] overflow-hidden"
        aria-hidden="true"
      >
        <Image
          src={brand.logo.markWhite}
          alt=""
          width={600}
          height={836}
          className="w-[150px] sm:w-[220px] h-auto object-contain"
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Top row: White Lockup Logo */}
        <div className="mb-6 sm:mb-7 flex items-center">
          <Image
            src={brand.logo.lockupWhite}
            alt="Skydrops"
            width={1000}
            height={726}
            priority={priorityLogo}
            className="w-[104px] sm:w-[124px] h-auto object-contain"
          />
        </div>

        {/* Title */}
        <h1 className="sk-title text-[28px] leading-[34px] sm:text-[32px] sm:leading-[38px] font-bold text-white tracking-[-0.02em] line-clamp-3">
          {title}
        </h1>

        {/* Description (if provided) */}
        {description && (
          <p className="sk-desc text-[15px] leading-6 text-white/80 mt-2.5 max-w-[52ch] whitespace-pre-wrap">
            {description}
          </p>
        )}
      </div>

      {/* Bottom Accent Line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{
          background: "linear-gradient(90deg, #1FA1FF 0%, #0B5BFF 100%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
