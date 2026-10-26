import Image from "next/image";
import { brand } from "@/lib/brand";

/**
 * Public parent brands footer displaying Skydrops Technologies and Skydrops Product website.
 * Styled as pill-shaped cards with soft blue glow matching brand design.
 */
export function BrandFooter() {
  return (
    <footer
      className="w-full mt-10 border-t border-(--divider) pt-7"
      style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}
    >
      {/* Brand Navigation */}
      <nav aria-label="Skydrops brands" className="w-full">
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3.5 sm:gap-4 items-stretch">
          {brand.parentBrands.map((b) => (
            <a
              key={b.name}
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-center gap-3.5 sm:gap-4 px-5 py-3 sm:px-6 sm:py-3.5 rounded-full bg-white border border-[#E0EAFA] shadow-[0_2px_14px_rgba(31,161,255,0.08),0_1px_3px_rgba(8,24,76,0.04)] hover:border-[#1FA1FF]/60 hover:shadow-[0_6px_22px_rgba(31,161,255,0.18)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--primary-ring) transition-all duration-200 motion-reduce:transition-none"
            >
              {/* Brand Logo */}
              <div
                className={
                  b.name === "Skydrops Water"
                    ? "w-20 sm:w-24 h-11 sm:h-12 flex items-center justify-center shrink-0"
                    : "w-12 sm:w-14 h-11 sm:h-12 flex items-center justify-center shrink-0"
                }
              >
                <Image
                  src={b.logo}
                  alt=""
                  width={b.logoWidth}
                  height={b.logoHeight}
                  className={
                    b.name === "Skydrops Water"
                      ? "h-5 sm:h-6 w-auto max-w-[85px] sm:max-w-[100px] object-contain transition-transform duration-200 group-hover:scale-105"
                      : "h-9 sm:h-10 w-auto max-w-[48px] sm:max-w-[54px] object-contain transition-transform duration-200 group-hover:scale-105"
                  }
                />
              </div>

              {/* Brand Title (2 lines) */}
              <div className="flex flex-col text-left justify-center min-w-0">
                <span className="text-[13px] sm:text-[14px] font-bold text-[#071642] group-hover:text-primary transition-colors leading-[1.25]">
                  {b.titleLine1}
                </span>
                <span className="text-[13px] sm:text-[14px] font-bold text-[#071642] group-hover:text-primary transition-colors leading-[1.25]">
                  {b.titleLine2}
                </span>
                <span className="sr-only">
                  {b.name} ({b.display}) (opens in a new tab)
                </span>
              </div>
            </a>
          ))}
        </div>
      </nav>

      {/* Copyright */}
      <p className="mt-6 text-center text-xs text-muted">
        © Skydrops. All rights reserved.
      </p>
    </footer>
  );
}
