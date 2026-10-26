"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Loader2, AlertCircle, RotateCcw, Check, ArrowRight } from "lucide-react";
import type { Field } from "@/types/form";
import { brand } from "@/lib/brand";
import { FieldRenderer } from "./field-renderer";
import { FormHeaderBand } from "./form-header-band";

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

  const hasRequiredField = visibleFields.some((f) => f.required);

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
      } else if (res.status === 429) {
        setSubmitError(
          data?.message ||
            "Too many attempts. Please wait a few minutes and try again."
        );
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
      <div className="sk-card w-full">
        {/* Header Band */}
        <FormHeaderBand
          title="Thank you"
          description="Your response has been recorded."
        />

        {/* Success Body */}
        <div className="px-5 pt-8 pb-10 sm:px-10 sm:pt-10 sm:pb-12 text-center flex flex-col items-center space-y-5">
          <div className="size-14 rounded-full bg-(--success-soft) flex items-center justify-center">
            <Check className="size-7 text-(--success)" strokeWidth={2.5} />
          </div>

          <p className="text-[15px] text-muted">
            Thank you for taking the time to complete this form.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="h-11 px-6 rounded-lg border border-border text-sm font-semibold text-(--ink) hover:bg-(--primary-soft) hover:border-(--border-hover) flex items-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="size-4 text-muted" />
              Submit another response
            </button>
          </div>
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
      className="sk-card w-full"
    >
      {/* Header Band with Title & Description */}
      <FormHeaderBand title={title} description={description} />

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

      {/* Form Body: 24px 20px 28px mobile / 36px 40px 40px desktop */}
      <div className="px-5 pt-6 pb-7 sm:px-10 sm:pt-9 sm:pb-10 bg-white">
        {/* Required indicator caption at top right (13px, color var(--muted), asterisk in danger) */}
        {hasRequiredField && (
          <div className="flex justify-end mb-5">
            <span className="text-[13px] text-muted font-normal">
              <span className="text-(--danger) mr-1">*</span>Required
            </span>
          </div>
        )}

        {/* Global Error Banner */}
        {(submitError || Object.keys(errors).length > 0) && (
          <div
            ref={errorSummaryRef}
            role="alert"
            className="rounded-lg border border-(--danger-border) bg-(--danger-soft) p-3 sm:p-3.5 text-[14px] text-(--danger-text) flex items-start gap-2.5 leading-relaxed mb-6"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-(--danger)" />
            <div>
              <p className="font-semibold text-(--danger-text)">
                Please fix the highlighted fields
              </p>
              {submitError && (
                <p className="text-xs text-(--danger-text)/90 mt-0.5">
                  {submitError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Form Fields: Gap between fields 24px */}
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

        {/* Submit Button: Full width, height 54px, radius 8px, margin-top 28px */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || isAnyFileUploading}
            className="sk-submit-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin shrink-0" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Image
                  src={brand.logo.markWhite}
                  alt=""
                  width={16}
                  height={22}
                  className="w-4 h-auto object-contain shrink-0"
                  aria-hidden="true"
                />
                <span>Submit</span>
                <ArrowRight
                  className="sk-submit-arrow size-4.5 shrink-0"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </>
            )}
          </button>
          {isAnyFileUploading && (
            <p className="text-[13px] text-muted text-center mt-2 font-medium">
              Wait for the upload to finish
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
