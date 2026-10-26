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
        <div className="grid grid-cols-2 gap-2 sm:gap-3.5 items-stretch">
          {brand.parentBrands.map((b) => (
            <a
              key={b.name}
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-center gap-2 sm:gap-3.5 px-2.5 py-2.5 sm:px-5 sm:py-3.5 rounded-[10px] bg-white border border-[#E0EAFA] shadow-[0_2px_14px_rgba(31,161,255,0.08),0_1px_3px_rgba(8,24,76,0.04)] hover:border-[#1FA1FF]/60 hover:shadow-[0_6px_22px_rgba(31,161,255,0.18)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--primary-ring) transition-all duration-200 motion-reduce:transition-none"
            >
              {/* Brand Logo */}
              <div
                className={
                  b.name === "Skydrops Water"
                    ? "w-12 sm:w-22 h-9 sm:h-11 flex items-center justify-center shrink-0"
                    : "w-8 sm:w-12 h-9 sm:h-11 flex items-center justify-center shrink-0"
                }
              >
                <Image
                  src={b.logo}
                  alt=""
                  width={b.logoWidth}
                  height={b.logoHeight}
                  className={
                    b.name === "Skydrops Water"
                      ? "h-4.5 sm:h-6.5 w-auto max-w-12 sm:max-w-25 object-contain transition-transform duration-200 group-hover:scale-105"
                      : "h-7 sm:h-9.5 w-auto max-w-8 sm:max-w-12 object-contain transition-transform duration-200 group-hover:scale-105"
                  }
                />
              </div>

              {/* Brand Title (2 lines) */}
              <div className="flex flex-col text-left justify-center min-w-0">
                <span className="text-[11px] sm:text-sm font-bold text-[#071642] group-hover:text-primary transition-colors leading-tight">
                  {b.titleLine1}
                </span>
                <span className="text-[11px] sm:text-sm font-bold text-[#071642] group-hover:text-primary transition-colors leading-tight">
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
