import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { brand } from "@/lib/brand";

/**
 * Public parent brands footer displaying Skydrops Water and Skydrops Technologies.
 * Restyled for U2: contained to 640px column, 1px divider, radius 8px hover tiles.
 */
export function BrandFooter() {
  return (
    <footer
      className="w-full mt-10 border-t border-(--divider) pt-7"
      style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}
    >
      {/* Label */}
      <p className="text-center text-[11px] font-semibold tracking-[0.14em] uppercase text-muted mb-3">
        OUR BRANDS
      </p>

      {/* Brand Navigation */}
      <nav aria-label="Skydrops brands" className="w-full">
        <div className="relative grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4 items-stretch">
          {/* 1px Vertical divider on screens >= 360px */}
          <div
            className="hidden min-[360px]:block absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-(--divider)"
            aria-hidden="true"
          />

          {brand.parentBrands.map((b) => (
            <a
              key={b.name}
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col items-center justify-between min-h-11 py-3 px-3 sm:py-3.5 sm:px-4 rounded-lg text-center bg-transparent hover:bg-white hover:border hover:border-(--divider) border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--primary-ring) transition-all motion-reduce:transition-none duration-150"
            >
              {/* Brand Logo */}
              <div className="h-9 sm:h-10 w-full flex items-center justify-center mb-2">
                <Image
                  src={b.logo}
                  alt={b.name}
                  width={b.logoWidth}
                  height={b.logoHeight}
                  className={
                    b.name === "Skydrops Water"
                      ? "h-6 sm:h-7 w-auto max-w-32.5 sm:max-w-37.5 object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                      : "h-8 sm:h-9 w-auto max-w-16.25 sm:max-w-18.75 object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                  }
                />
              </div>

              {/* Brand Name & Domain */}
              <div className="flex flex-col items-center">
                <span className="inline-flex items-center text-[13px] sm:text-sm font-semibold text-(--ink) group-hover:text-primary group-focus-visible:text-primary transition-colors motion-reduce:transition-none">
                  {b.name}
                  <ArrowUpRight
                    className="size-3.5 ml-1 shrink-0 text-muted group-hover:text-primary group-focus-visible:text-primary transition-colors motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                  <span className="sr-only"> (opens in a new tab)</span>
                </span>
                <span className="mt-0.5 text-xs font-normal text-muted group-hover:text-(--primary)/80 transition-colors">
                  {b.display}
                </span>
              </div>
            </a>
          ))}
        </div>
      </nav>

      {/* Copyright */}
      <p className="mt-5 text-center text-xs text-muted">
        © Skydrops. All rights reserved.
      </p>
    </footer>
  );
}
