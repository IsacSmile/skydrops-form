import Image from "next/image";
import { brand } from "@/lib/brand";

interface FormHeaderBandProps {
  title: string;
  description?: string | null;
  priorityLogo?: boolean;
}

/**
 * Reusable Light & Airy Header Band rendered inside the top of the card.
 * Shared across active form, thank-you, closed, not-found states, and form-preview.
 */
export function FormHeaderBand({
  title,
  description,
  priorityLogo = true,
}: FormHeaderBandProps) {
  return (
    <div className="sk-header-container">
      {/* Background Image: Sky, clouds & large water drop art */}
      <Image
        src={brand.logo.headerBackground}
        alt=""
        fill
        priority={priorityLogo}
        quality={80}
        sizes="(min-width: 640px) 640px, 100vw"
        className="object-cover z-0 object-[72%_top] sm:object-[right_top]"
        aria-hidden="true"
      />

      {/* Legibility Overlay for WCAG AA Contrast over Clouds */}
      <div className="sk-header-overlay" aria-hidden="true" />

      {/* Header Content */}
      <div className="relative z-2 px-5 pt-6 pb-7 sm:px-10 sm:pt-10 sm:pb-11">
        {/* On desktop text column has max-width 62% to preserve drop and clouds on the right */}
        <div className="w-full sm:max-w-[62%]">
          {/* 1. Full-colour Horizontal Brand Logo */}
          <div className="mb-7 sm:mb-10">
            <Image
              src={brand.logo.horizontal}
              alt="Skydrops, Sustainable Water Technologies"
              width={1400}
              height={429}
              priority={priorityLogo}
              className="w-[232px] sm:w-[280px] h-auto object-contain"
            />
          </div>

          {/* 2. Form Title (h1) */}
          <h1 className="sk-title font-bold text-[30px] leading-9 sm:text-[42px] sm:leading-12 text-(--ink) tracking-[-0.025em] m-0">
            {title}
          </h1>

          {/* 3. Form Description (if provided) */}
          {description && (
            <p className="sk-desc font-normal text-[15px] leading-[23px] sm:text-[17px] sm:leading-[27px] text-(--text-soft) mt-3.5 max-w-[34rem] whitespace-pre-wrap">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
