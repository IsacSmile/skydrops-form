import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import { getPublicFormBySlug, SLUG_REGEX } from "@/lib/forms-data";
import { getAppOrigin } from "@/lib/short-link";
import { brand } from "@/lib/brand";
import { PublicForm } from "@/components/public/public-form";

export const instant = false;

interface FormPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: FormPageProps): Promise<Metadata> {
  const { slug } = await params;
  const normalized = slug.trim().toLowerCase();

  if (!SLUG_REGEX.test(normalized)) {
    return {
      title: "Form not found",
      robots: { index: false, follow: false },
    };
  }

  const data = await getPublicFormBySlug(normalized);
  if (!data) {
    return {
      title: "Form not found",
      robots: { index: false, follow: false },
    };
  }

  const origin = await getAppOrigin();
  const ogImageUrl = `${origin}/brand/skydrops-logo-full.png`;
  const desc = data.form.description || "Fill out this form from Skydrops";

  return {
    title: data.form.title,
    description: desc,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: data.form.title,
      description: desc,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 999,
          alt: brand.name,
        },
      ],
    },
  };
}

export default async function PublicFormPage({ params }: FormPageProps) {
  await connection();
  const { slug } = await params;
  const normalized = slug.trim().toLowerCase();

  if (!SLUG_REGEX.test(normalized)) {
    notFound();
  }

  const data = await getPublicFormBySlug(normalized);
  if (!data) {
    notFound();
  }

  const { form, fields } = data;

  return (
    <main className="w-full min-h-screen py-10 sm:py-16 px-4 flex flex-col items-center justify-between">
      {/* Centered Column */}
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

        {/* Form Body or Closed State */}
        {form.status === "closed" ? (
          <div className="relative rounded-2xl sm:rounded-[20px] border border-[#DCE6F5] bg-card p-6 sm:p-10 shadow-[0_1px_2px_rgba(17,16,20,0.04),0_12px_32px_-12px_rgba(11,91,255,0.18)] text-center space-y-4 overflow-hidden">
            {/* 4px Decorative top gradient strip */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: brand.gradient }}
              aria-hidden="true"
            />
            <div className="pt-2 space-y-2">
              <h1 className="text-[26px] leading-[32px] sm:text-[30px] sm:leading-[36px] font-bold tracking-[-0.02em] text-[#111014]">
                This form is closed
              </h1>
              <p className="text-[15px] leading-[24px] text-[#5B6475]">
                This form is no longer accepting new responses.
              </p>
            </div>
          </div>
        ) : (
          <PublicForm
            slug={normalized}
            title={form.title}
            description={form.description}
            fields={fields}
          />
        )}
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
