import Image from "next/image";
import { brand } from "@/lib/brand";

export default function PublicNotFound() {
  return (
    <main className="w-full min-h-screen py-10 sm:py-16 px-4 flex flex-col items-center justify-between">
      <div className="w-full max-w-xl mx-auto space-y-6 sm:space-y-8">
        {/* Brand Header */}
        <header className="flex justify-center">
          <div className="relative w-[168px] sm:w-[200px] h-auto flex items-center justify-center">
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
            <h1 className="text-[26px] leading-[32px] sm:text-[30px] sm:leading-[36px] font-bold tracking-[-0.02em] text-[#111014]">
              Form not found
            </h1>
            <p className="text-[15px] leading-[24px] text-[#5B6475]">
              This form does not exist or may have been removed.
            </p>
          </div>
        </div>
      </div>

      {/* Powered by Skydrops Footer */}
      <footer className="pt-10 pb-4 flex items-center justify-center gap-2 text-xs font-medium text-[#5B6475] select-none">
        <Image
          src={brand.logo.mark}
          alt=""
          width={20}
          height={28}
          className="h-5 w-auto object-contain opacity-75"
          aria-hidden="true"
        />
        <span>Powered by Skydrops</span>
      </footer>
    </main>
  );
}
