import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublicFormBySlug, SLUG_REGEX } from "@/lib/forms-data";
import { getAppOrigin } from "@/lib/short-link";
import { brand } from "@/lib/brand";
import { isFileUploadsEnabled } from "@/lib/feature-flags";
import { PublicForm } from "@/components/public/public-form";
import { FormHeaderBand } from "@/components/public/form-header-band";

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
  const fileUploadsEnabled = isFileUploadsEnabled();

  if (form.status === "closed") {
    return (
      <div className="sk-card w-full">
        <FormHeaderBand
          title="This form is closed"
          description="This form is no longer accepting new responses."
        />
        <div className="px-5 pt-6 pb-7 sm:px-10 sm:pt-9 sm:pb-10 text-center">
          <p className="text-[15px] leading-6 text-[var(--muted)]">
            This form is currently closed to new submissions. Please contact the organizer if you believe this is in error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PublicForm
      slug={normalized}
      formId={form.id}
      fileUploadsEnabled={fileUploadsEnabled}
      title={form.title}
      description={form.description}
      fields={fields}
    />
  );
}
