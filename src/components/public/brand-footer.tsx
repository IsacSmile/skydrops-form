import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { brand } from "@/lib/brand";

/**
 * Public parent brands footer displaying Skydrops Water and Skydrops Technologies.
 * Server component: no client JS needed.
 */
export function BrandFooter() {
  return (
    <footer
      className="w-full mt-10 sm:mt-14 border-t border-[#DCE6F5] pt-8 sm:pt-10 px-4"
      style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}
    >
      {/* Brand Navigation */}
      <nav aria-label="Skydrops brands" className="w-full max-w-xl mx-auto">
        <div className="relative grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-6 items-stretch">
          {/* 1px Vertical divider on screens >= 360px */}
          <div
            className="hidden min-[360px]:block absolute left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-[#DCE6F5]"
            aria-hidden="true"
          />

          {brand.parentBrands.map((b) => (
            <a
              key={b.name}
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col items-center justify-between py-3.5 px-3 sm:py-4 sm:px-5 rounded-2xl text-center bg-transparent hover:bg-white/90 hover:shadow-[0_2px_12px_rgba(11,91,255,0.06)] border border-transparent hover:border-[#DCE6F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5BFF]/35 transition-all motion-reduce:transition-none duration-150"
            >
              {/* Brand Logo */}
              <div className="h-10 sm:h-12 w-full flex items-center justify-center mb-2.5">
                <Image
                  src={b.logo}
                  alt={b.name}
                  width={b.logoWidth}
                  height={b.logoHeight}
                  className={
                    b.name === "Skydrops Water"
                      ? "h-7 sm:h-8 w-auto max-w-[140px] sm:max-w-[160px] object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                      : "h-9 sm:h-11 w-auto max-w-[70px] sm:max-w-[80px] object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                  }
                />
              </div>

              {/* Brand Name & Domain */}
              <div className="flex flex-col items-center">
                <span className="inline-flex items-center text-xs sm:text-[13px] font-semibold text-[#111014] group-hover:text-[#0B5BFF] group-focus-visible:text-[#0B5BFF] transition-colors motion-reduce:transition-none">
                  {b.name}
                  <ArrowUpRight
                    className="size-3.5 ml-1 shrink-0 text-[#5B6475] group-hover:text-[#0B5BFF] group-focus-visible:text-[#0B5BFF] transition-colors motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                  <span className="sr-only"> (opens in a new tab)</span>
                </span>
                <span className="mt-0.5 text-[11px] sm:text-xs font-normal text-[#5B6475] group-hover:text-[#0B5BFF]/80 transition-colors">
                  {b.display}
                </span>
              </div>
            </a>
          ))}
        </div>
      </nav>

      {/* Copyright */}
      <p className="mt-6 text-center text-xs text-[#5B6475]">
        © Skydrops. All rights reserved.
      </p>
    </footer>
  );
}
