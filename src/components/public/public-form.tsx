"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import type { Field } from "@/types/form";
import { FieldRenderer } from "./field-renderer";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";

interface PublicFormProps {
  slug: string;
  formId?: string;
  fileUploadsEnabled?: boolean;
  title: string;
  description: string | null;
  fields: Field[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PublicForm({
  slug,
  formId,
  fileUploadsEnabled = false,
  title,
  description,
  fields,
}: PublicFormProps) {
  const visibleFields = fileUploadsEnabled
    ? fields
    : fields.filter((f) => f.type !== "file");

  // Initialize values
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const f of visibleFields) {
      initial[f.key] = f.type === "checkbox" ? [] : "";
    }
    return initial;
  });

  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(new Set());

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  function handleUploadingChange(fieldKey: string, uploading: boolean) {
    setUploadingFields((prev) => {
      const next = new Set(prev);
      if (uploading) {
        next.add(fieldKey);
      } else {
        next.delete(fieldKey);
      }
      return next;
    });
  }

  const isAnyFileUploading = uploadingFields.size > 0;

  function handleFieldChange(fieldKey: string, val: unknown) {
    setAnswers((prev) => ({
      ...prev,
      [fieldKey]: val,
    }));
    // Clear error for this field on edit
    if (errors[fieldKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
    setSubmitError(null);
  }

  function validateClient(): Record<string, string> {
    const newErrors: Record<string, string> = {};

    for (const f of visibleFields) {
      const val = answers[f.key];

      if (f.type === "checkbox") {
        const arr = Array.isArray(val) ? val : [];
        if (f.required && arr.length === 0) {
          newErrors[f.key] = "This field is required.";
        }
        continue;
      }

      const strVal = typeof val === "string" ? val.trim() : "";

      if (f.type === "file") {
        if (f.required && (val === undefined || val === null || strVal === "")) {
          newErrors[f.key] = "This field is required.";
        }
        continue;
      }

      if (f.required && (val === undefined || val === null || strVal === "")) {
        newErrors[f.key] = "This field is required.";
        continue;
      }

      if (strVal !== "") {
        if (f.type === "email" && !EMAIL_REGEX.test(strVal)) {
          newErrors[f.key] = "Enter a valid email address.";
        } else if (f.type === "number" && !Number.isFinite(Number(strVal))) {
          newErrors[f.key] = "Enter a valid number.";
        }
      }
    }

    return newErrors;
  }

  function focusFirstError(fieldErrors: Record<string, string>) {
    const errorKeys = Object.keys(fieldErrors);
    if (errorKeys.length === 0) return;

    // Find the first field in position order that has an error
    const firstInvalidField = visibleFields.find((f) => errorKeys.includes(f.key));
    if (!firstInvalidField) return;

    const elId = `field-${firstInvalidField.key || firstInvalidField.id}`;
    setTimeout(() => {
      const el = document.getElementById(elId);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        errorSummaryRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 50);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);

    // 1. Client-side validation for immediate UX feedback
    const clientErrors = validateClient();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      focusFirstError(clientErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          answers,
          website: website || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        setIsSuccess(true);
        return;
      }

      if (res.status === 422 && data?.fieldErrors) {
        setErrors(data.fieldErrors);
        focusFirstError(data.fieldErrors);
        setSubmitError(data.message || "Please check your answers and try again.");
      } else if (res.status === 403) {
        setSubmitError("This form is closed and no longer accepting submissions.");
      } else if (res.status === 404) {
        setSubmitError("This form could not be found.");
      } else {
        setSubmitError(
          data?.message || "Something went wrong. Please check your connection and try again."
        );
      }
    } catch {
      setSubmitError(
        "Network error. Please check your internet connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    const initial: Record<string, unknown> = {};
    for (const f of visibleFields) {
      initial[f.key] = f.type === "checkbox" ? [] : "";
    }
    setAnswers(initial);
    setWebsite("");
    setErrors({});
    setSubmitError(null);
    setUploadingFields(new Set());
    setIsSuccess(false);
  }

  // -------------------------------------------------------------------------
  // Thank-you Success Screen
  // -------------------------------------------------------------------------
  if (isSuccess) {
    return (
      <div className="relative rounded-2xl sm:rounded-[20px] border border-[#DCE6F5] bg-card p-6 sm:p-10 shadow-[0_1px_2px_rgba(17,16,20,0.04),0_12px_32px_-12px_rgba(11,91,255,0.18)] text-center space-y-6 overflow-hidden">
        {/* Decorative top gradient strip */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: brand.gradient }}
          aria-hidden="true"
        />

        <div className="pt-4 flex flex-col items-center space-y-4">
          <div className="size-14 relative flex items-center justify-center">
            <Image
              src={brand.logo.mark}
              alt="Skydrops"
              width={56}
              height={78}
              className="h-14 w-auto object-contain"
            />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111014]">
              Thank you!
            </h2>
            <p className="text-base text-[#5B6475]">
              Your response has been recorded.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="h-11 px-6 rounded-xl text-sm font-semibold border-[#DCE6F5] text-[#111014] hover:bg-[#F4F8FF] gap-2"
          >
            <RotateCcw className="size-4 text-[#5B6475]" />
            Submit another response
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Form Screen
  // -------------------------------------------------------------------------
  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="relative rounded-2xl sm:rounded-[20px] border border-[#DCE6F5] bg-card p-6 sm:p-10 shadow-[0_1px_2px_rgba(17,16,20,0.04),0_12px_32px_-12px_rgba(11,91,255,0.18)] space-y-8 overflow-hidden"
    >
      {/* 4px Decorative top gradient strip (never text on it) */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: brand.gradient }}
        aria-hidden="true"
      />

      {/* Honeypot field (hidden offscreen, tabIndex -1, NOT display:none) */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none"
      />

      {/* Form Header (Title & Description) */}
      <div className="space-y-2 border-b border-[#DCE6F5] pb-6">
        <h1 className="text-[26px] leading-8 sm:text-[30px] sm:leading-9 font-bold tracking-[-0.02em] text-[#111014]">
          {title}
        </h1>
        {description && (
          <p className="text-[15px] leading-6 text-[#5B6475] whitespace-pre-wrap">
            {description}
          </p>
        )}
      </div>

      {/* Global Error Banner */}
      {(submitError || Object.keys(errors).length > 0) && (
        <div
          ref={errorSummaryRef}
          role="alert"
          className="rounded-xl border border-[#D92D20]/20 bg-[#D92D20]/10 p-4 text-[13px] text-[#D92D20] flex items-start gap-2.5 leading-relaxed"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>
            {submitError || "Please check the highlighted fields below."}
          </span>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-6">
        {visibleFields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={answers[field.key]}
            onChange={(val) => handleFieldChange(field.key, val)}
            error={errors[field.key]}
            disabled={isSubmitting}
            slug={slug}
            formId={formId}
            onUploadingChange={(uploading) =>
              handleUploadingChange(field.key, uploading)
            }
          />
        ))}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting || isAnyFileUploading}
          className="w-full h-13 rounded-xl text-base font-semibold text-white transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(11,91,255,0.35)] focus-visible:ring-offset-2"
          style={{
            backgroundColor:
              isSubmitting || isAnyFileUploading
                ? brand.primaryHover
                : brand.primary,
            opacity: isSubmitting || isAnyFileUploading ? 0.8 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting && !isAnyFileUploading) {
              e.currentTarget.style.backgroundColor = brand.primaryHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isSubmitting && !isAnyFileUploading) {
              e.currentTarget.style.backgroundColor = brand.primary;
            }
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <span>Submit</span>
          )}
        </button>
        {isAnyFileUploading && (
          <p className="text-xs text-[#5B6475] text-center mt-2 font-medium">
            Wait for the upload to finish
          </p>
        )}
      </div>
    </form>
  );
}
