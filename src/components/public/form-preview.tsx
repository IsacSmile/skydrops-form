"use client";

import { useState } from "react";
import Image from "next/image";
import type { Form, Field } from "@/types/form";
import { brand } from "@/lib/brand";
import { FieldRenderer } from "./field-renderer";
import { FormHeaderBand } from "./form-header-band";
import { Layers } from "lucide-react";
import "./sk-form.css";

interface FormPreviewProps {
  form: Form;
  fields: Field[];
}

export function FormPreview({ form, fields }: FormPreviewProps) {
  // Local throwaway state for interactive preview
  const [values, setValues] = useState<Record<string, unknown>>({});

  function handleFieldChange(fieldId: string, val: unknown) {
    setValues((prev) => ({
      ...prev,
      [fieldId]: val,
    }));
  }

  const hasRequiredField = fields.some((f) => f.required);

  return (
    <div className="sk-form w-full max-w-2xl mx-auto">
      {/* Live Form Preview Card styled in Deep Sky */}
      <div className="sk-card w-full">
        <FormHeaderBand
          title={form.title || "Untitled Form"}
          description={form.description}
          priorityLogo={false}
        />

        <div className="px-5 pt-6 pb-7 sm:px-10 sm:pt-9 sm:pb-10 bg-white space-y-6 sm:space-y-7">
          {hasRequiredField && (
            <div className="flex justify-end -mt-1 mb-6">
              <span className="text-xs text-muted font-normal">
                <span className="text-(--danger) mr-1">*</span>Required
              </span>
            </div>
          )}

          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted space-y-3">
              <div className="p-3 bg-(--page) rounded-full">
                <Layers className="size-6 text-muted" />
              </div>
              <p className="text-sm font-medium text-(--text)">No fields yet</p>
              <p className="text-xs text-muted max-w-xs">
                Add fields in the Build tab to preview how respondents will experience your form.
              </p>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-7">
              {fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  onChange={(val) => handleFieldChange(field.id, val)}
                  disabled={false}
                />
              ))}

              <div className="pt-2 mt-8">
                <button
                  type="button"
                  disabled
                  className="sk-submit-btn opacity-80 cursor-not-allowed group"
                >
                  <Image
                    src={brand.logo.markWhite}
                    alt=""
                    width={18}
                    height={25}
                    className="w-4 h-auto object-contain shrink-0"
                    aria-hidden="true"
                  />
                  <span className="tracking-[0.12em] font-semibold">SUBMIT</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
