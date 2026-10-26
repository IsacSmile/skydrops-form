import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { brand } from "@/lib/brand";

/**
 * U3 Brand Link Cards Footer.
 * Renders two parent brand link cards (Technologies, Water) with 56x40 logo slots,
 * labels, ArrowRight, vertical divider from 520px, and static copyright line.
 */
export function BrandFooter() {
  return (
    <footer
      className="w-full mt-5"
      style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}
    >
      {/* Brand Navigation */}
      <nav aria-label="Skydrops websites" className="w-full">
        <div className="relative grid grid-cols-1 min-[520px]:grid-cols-2 gap-3 min-[520px]:gap-4 items-stretch">
          {/* Centered vertical divider between columns on >= 520px */}
          <div
            className="hidden min-[520px]:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-10 bg-(--border) pointer-events-none z-10"
            aria-hidden="true"
          />

          {brand.parentBrands.map((b) => (
            <a
              key={b.key}
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              className="sk-brand-card group"
            >
              {/* Fixed 56x40 Logo Slot */}
              <div className="w-[56px] h-[40px] relative shrink-0 flex items-center justify-start">
                <Image
                  src={b.logo}
                  alt=""
                  width={b.logoWidth}
                  height={b.logoHeight}
                  className="w-full h-full object-contain object-left"
                />
              </div>

              {/* Card Label (15px/20px weight 600 var(--ink)) */}
              <span className="sk-brand-card-label flex-1 line-clamp-2">
                {b.label}
              </span>

              {/* Lucide ArrowRight (18px, shifts 2px right on hover) */}
              <ArrowRight
                className="sk-brand-card-arrow"
                strokeWidth={2}
                aria-hidden="true"
              />

              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ))}
        </div>
      </nav>

      {/* Static Copyright without year or new Date() */}
      <p className="mt-6 text-center text-[13px] text-(--muted) select-none">
        © Skydrops. All rights reserved.
      </p>
    </footer>
  );
}
