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
        className="object-cover z-0 object-[72%_top] sm:object-top-right"
        aria-hidden="true"
      />

      {/* Legibility Overlay for WCAG AA Contrast over Clouds */}
      <div className="sk-header-overlay" aria-hidden="true" />

      {/* Header Content */}
      <div className="relative z-2 px-5 pt-5 pb-5 sm:px-9 sm:pt-7 sm:pb-7">
        {/* On desktop text column has max-width 64% to preserve drop and clouds on the right */}
        <div className="w-full sm:max-w-[64%]">
          {/* 1. Full-colour Horizontal Brand Logo */}
          <div className="mb-4 sm:mb-5">
            <Image
              src={brand.logo.horizontal}
              alt="Skydrops, Sustainable Water Technologies"
              width={1400}
              height={429}
              priority={priorityLogo}
              className="w-48 sm:w-56 h-auto object-contain"
            />
          </div>

          {/* 2. Form Title (h1) */}
          <h1 className="sk-title font-bold text-2xl leading-8 sm:text-3xl sm:leading-10 text-(--ink) tracking-tight m-0">
            {title}
          </h1>

          {/* 3. Form Description (if provided) */}
          {description && (
            <p className="sk-desc font-normal text-sm leading-5.5 sm:text-[15px] sm:leading-6 text-(--text-soft) mt-2 sm:mt-2.5 max-w-136 whitespace-pre-wrap">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
