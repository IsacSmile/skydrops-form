import Image from "next/image";
import { brand } from "@/lib/brand";

export default function PublicNotFound() {
  return (
    <main className="w-full py-10 sm:py-16 px-4 flex flex-col items-center flex-1">
      <div className="w-full max-w-xl mx-auto space-y-6 sm:space-y-8">
        {/* Brand Header */}
        <header className="flex justify-center">
          <div className="relative w-42 sm:w-50 h-auto flex items-center justify-center">
            <Image
              src={brand.logo.lockup}
              alt="Skydrops"
              width={1000}
              height={726}
              priority
              className="w-full h-auto object-contain"
            />
          </div>
        </header>

        {/* Not Found Card */}
        <div className="relative rounded-2xl sm:rounded-[20px] border border-[#DCE6F5] bg-card p-6 sm:p-10 shadow-[0_1px_2px_rgba(17,16,20,0.04),0_12px_32px_-12px_rgba(11,91,255,0.18)] text-center space-y-4 overflow-hidden">
          {/* 4px Decorative top gradient strip */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: brand.gradient }}
            aria-hidden="true"
          />

          <div className="pt-2 space-y-2">
            <h1 className="text-[26px] leading-8 sm:text-[30px] sm:leading-9 font-bold tracking-[-0.02em] text-[#111014]">
              Form not found
            </h1>
            <p className="text-[15px] leading-6 text-[#5B6475]">
              This form does not exist or may have been removed.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
