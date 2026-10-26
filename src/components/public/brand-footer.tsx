import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { brand } from "@/lib/brand";

/**
 * Public "Our brands" footer displaying the two parent brands.
 * Server component: no client JS needed.
 */
export function BrandFooter() {
  return (
    <footer
      className="w-full mt-10 sm:mt-12 border-t border-[#DCE6F5] pt-10 sm:pt-12 px-4"
      style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}
    >
      {/* Decorative Drop Mark */}
      <div className="flex justify-center">
        <Image
          src={brand.logo.mark}
          alt=""
          width={20}
          height={28}
          className="w-5 h-auto object-contain opacity-80"
          aria-hidden="true"
        />
      </div>

      {/* Label */}
      <p className="mt-2 text-center text-[11px] font-semibold tracking-[0.12em] uppercase text-[#5B6475]">
        OUR BRANDS
      </p>

      {/* Brand Navigation */}
      <nav
        aria-label="Skydrops brands"
        className="mt-4 w-full max-w-xl mx-auto"
      >
        <div className="relative grid grid-cols-1 min-[360px]:grid-cols-2 gap-4 items-center">
          {/* 1px Vertical divider on screens >= 360px */}
          <div
            className="hidden min-[360px]:block absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-[#DCE6F5]"
            aria-hidden="true"
          />

          {brand.parentBrands.map((b) => (
            <a
              key={b.name}
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center justify-center min-h-[44px] py-2.5 px-3 sm:py-3 sm:px-4 rounded-xl text-center hover:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5BFF]/35 transition-[color,background-color] motion-reduce:transition-none duration-150"
            >
              <span className="inline-flex items-center text-sm font-semibold text-[#111014] group-hover:text-[#0B5BFF] group-focus-visible:text-[#0B5BFF] group-hover:underline group-focus-visible:underline underline-offset-4 transition-colors motion-reduce:transition-none">
                {b.name}
                <ArrowUpRight
                  className="size-3.5 ml-1 shrink-0 text-[#5B6475] group-hover:text-[#0B5BFF] group-focus-visible:text-[#0B5BFF] transition-colors motion-reduce:transition-none"
                  aria-hidden="true"
                />
                <span className="sr-only"> (opens in a new tab)</span>
              </span>
              <span className="mt-0.5 text-xs font-normal text-[#5B6475]">
                {b.display}
              </span>
            </a>
          ))}
        </div>
      </nav>

      {/* Copyright */}
      <p className="mt-4 text-center text-xs text-[#5B6475]">
        © Skydrops. All rights reserved.
      </p>
    </footer>
  );
}
