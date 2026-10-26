"use client";

import { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  AlertCircle,
  Check,
  ChevronDown,
} from "lucide-react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { upload } from "@vercel/blob/client";
import type { Field } from "@/types/form";
import {
  Select,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ACCEPT_ATTR,
  buildUploadPrefix,
  sanitizeFileName,
  isAllowedFile,
} from "@/lib/upload-policy";
import { getFieldIconName, FIELD_ICON_COMPONENTS } from "@/lib/field-icons";

export interface FieldRendererProps {
  field: Field;
  value?: unknown;
  onChange?: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  slug?: string;
  formId?: string;
  onUploadingChange?: (uploading: boolean) => void;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileFieldControlProps {
  inputId: string;
  field: Field;
  value?: unknown;
  onChange?: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  slug?: string;
  formId?: string;
  onUploadingChange?: (uploading: boolean) => void;
}

function FileFieldControl({
  inputId,
  field,
  value,
  onChange,
  error,
  disabled = false,
  slug,
  formId,
  onUploadingChange,
}: FileFieldControlProps) {
  const isPreview = !slug || !formId;

  const [status, setStatus] = useState<"idle" | "uploading" | "uploaded" | "error">(() => {
    return typeof value === "string" && value.length > 0 ? "uploaded" : "idle";
  });
  const [progress, setProgress] = useState(0);
  const [fileMeta, setFileMeta] = useState<{ name: string; size?: number } | null>(() => {
    if (typeof value === "string" && value.length > 0) {
      const name = decodeURIComponent(value.split("/").pop() || "Uploaded file");
      return { name };
    }
    return null;
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  // Sync state when external value changes
  if (value !== prevValue) {
    setPrevValue(value);
    if (!value) {
      setStatus("idle");
      setFileMeta(null);
      setProgress(0);
      setErrorMessage(null);
    } else if (typeof value === "string" && value.length > 0 && status !== "uploading") {
      setStatus("uploaded");
      const name = decodeURIComponent(value.split("/").pop() || "Uploaded file");
      setFileMeta((prev) => prev ?? { name });
    }
  }

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // In preview / disabled mode
  if (isPreview) {
    return (
      <div className="space-y-1.5">
        <div className="rounded-lg border-[1.5px] border-dashed border-border p-2.5 sm:p-3.5 bg-[#F8FAFE] opacity-75 cursor-not-allowed flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="size-9 sm:size-10 rounded-lg bg-(--primary-soft) text-primary flex items-center justify-center shrink-0">
              <UploadCloud className="size-4.5 sm:size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm sm:text-[15px] font-semibold text-(--ink) block leading-snug truncate">
                Choose a file
              </span>
              <span className="text-xs sm:text-[13px] text-muted block leading-snug truncate">
                <span className="sm:hidden">Max 5 MB &bull; PDF, PNG, JPG</span>
                <span className="hidden sm:inline">JPG, PNG, WebP, PDF, DOC or DOCX &bull; Max 5 MB</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg border border-border bg-white text-xs sm:text-[13px] font-semibold text-muted cursor-not-allowed shrink-0"
          >
            Browse
          </button>
        </div>
      </div>
    );
  }

  async function handleFileSelected(file: File) {
    if (!slug || !formId) return;

    const check = isAllowedFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!check.ok) {
      setErrorMessage(check.message);
      setStatus("error");
      return;
    }

    setErrorMessage(null);
    setStatus("uploading");
    setProgress(0);
    setFileMeta({ name: file.name, size: file.size });
    onUploadingChange?.(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let serverErrorMessage: string | null = null;
    const originalFetch = typeof window !== "undefined" ? window.fetch : null;
    if (originalFetch) {
      window.fetch = async (...args) => {
        const res = await originalFetch(...args);
        const urlStr =
          typeof args[0] === "string"
            ? args[0]
            : args[0] instanceof Request
            ? args[0].url
            : "";
        if (urlStr.includes("/api/upload") && !res.ok) {
          try {
            const cloned = res.clone();
            const json = await cloned.json();
            if (json && typeof json.message === "string") {
              serverErrorMessage = json.message;
            }
          } catch {
            // Ignore parse errors
          }
        }
        return res;
      };
    }

    try {
      const cleanName = sanitizeFileName(file.name);
      const pathname = `${buildUploadPrefix(formId, field.key)}${cleanName}`;

      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        clientPayload: JSON.stringify({ slug, fieldKey: field.key }),
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => {
          setProgress(percentage);
        },
      });

      setStatus("uploaded");
      onUploadingChange?.(false);
      onChange?.(blob.url);
    } catch {
      onUploadingChange?.(false);
      if (controller.signal.aborted) {
        setStatus("idle");
        setFileMeta(null);
        setProgress(0);
        onChange?.("");
        return;
      }
      setErrorMessage(serverErrorMessage || "Upload failed. Please try again.");
      setStatus("error");
    } finally {
      if (originalFetch && typeof window !== "undefined") {
        window.fetch = originalFetch;
      }
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  function handleRemove() {
    setStatus("idle");
    setFileMeta(null);
    setProgress(0);
    setErrorMessage(null);
    onChange?.("");
  }

  return (
    <div className="space-y-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id={inputId}
        name={field.key}
        type="file"
        accept={ACCEPT_ATTR}
        disabled={disabled || status === "uploading"}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            handleFileSelected(f);
          }
          e.target.value = "";
        }}
      />

      {/* Uploading State */}
      {status === "uploading" && (
        <div className="p-3.5 rounded-lg border border-(--divider) bg-white space-y-2.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-medium text-(--ink) truncate max-w-50 sm:max-w-xs">
              Uploading {fileMeta?.name}...
            </span>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-primary">
                {Math.round(progress)}%
              </span>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs font-semibold text-muted hover:text-(--danger) cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="w-full bg-[#E6ECF5] rounded-[3px] h-1.5 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-150 ease-out rounded-[3px]"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}

      {/* Uploaded State */}
      {status === "uploaded" && (
        <div className="flex items-center justify-between p-3.5 rounded-lg border border-[#ABEFC6] bg-(--success-soft)">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="size-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
              <Check className="size-4 text-(--success) stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-(--ink) truncate">
                {fileMeta?.name ?? "Uploaded file"}
              </p>
              {fileMeta?.size && (
                <p className="text-xs text-muted">
                  {formatBytes(fileMeta.size)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
            >
              Replace
            </button>
            <span className="text-(--divider)" aria-hidden="true">
              |
            </span>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="text-xs font-semibold text-(--danger-text) hover:underline cursor-pointer disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="p-3.5 rounded-lg border border-(--danger-border) bg-(--danger-soft) space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-(--danger) shrink-0 mt-0.5" />
              <span className="text-xs text-(--danger-text) font-medium leading-relaxed">
                {errorMessage || "Upload failed."}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setStatus("idle");
                fileInputRef.current?.click();
              }}
              className="text-xs font-semibold text-primary hover:underline shrink-0 cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Idle State */}
      {status === "idle" && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => {
            if (!disabled) fileInputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (disabled) return;
            const f = e.dataTransfer.files?.[0];
            if (f) {
              handleFileSelected(f);
            }
          }}
          className={`rounded-lg border-[1.5px] border-dashed p-2.5 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer transition-all ${
            isDragging
              ? "border-primary bg-(--primary-soft)"
              : "border-border bg-[#F8FAFE] hover:border-primary hover:bg-(--primary-soft)"
          } ${error ? "border-(--danger)" : ""}`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="size-9 sm:size-10 rounded-lg bg-(--primary-soft) text-primary flex items-center justify-center shrink-0">
              <UploadCloud className="size-4.5 sm:size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm sm:text-[15px] font-semibold text-(--ink) block leading-snug truncate">
                Choose a file
              </span>
              <span className="text-xs sm:text-[13px] text-muted block leading-snug truncate">
                <span className="sm:hidden">Max 5 MB &bull; PDF, PNG, JPG</span>
                <span className="hidden sm:inline">JPG, PNG, WebP, PDF, DOC or DOCX &bull; Max 5 MB</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg border border-border bg-white text-xs sm:text-[13px] font-semibold text-(--ink) hover:border-(--border-hover) hover:bg-(--primary-soft) pointer-events-none transition-colors shrink-0 shadow-xs"
          >
            Browse
          </button>
        </div>
      )}
    </div>
  );
}

export function FieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled = false,
  slug,
  formId,
  onUploadingChange,
}: FieldRendererProps) {
  const inputId = `field-${field.key || field.id}`;
  const options = field.options ?? [];

  // Determine automatic field icon (aria-hidden)
  const iconName = getFieldIconName(field);
  const IconComponent = iconName ? FIELD_ICON_COMPONENTS[iconName] : null;

  return (
    <div className="space-y-2">
      {/* Field Label with Required Asterisk */}
      <label
        htmlFor={inputId}
        className="block text-[15px] leading-5.5 font-semibold text-(--ink) mb-2"
      >
        <span>{field.label}</span>
        {field.required && (
          <span
            className="text-(--danger) font-normal ml-1"
            aria-hidden="true"
          >
            *
          </span>
        )}
      </label>

      {/* Field Input Control by Type */}
      {(() => {
        switch (field.type) {
          case "short_text":
            return (
              <div className="sk-input-wrapper">
                {IconComponent && (
                  <IconComponent
                    className="sk-input-icon"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                )}
                <input
                  id={inputId}
                  name={field.key}
                  type="text"
                  placeholder={field.placeholder ?? undefined}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => onChange?.(e.target.value)}
                  disabled={disabled}
                  aria-invalid={!!error}
                  className={`sk-input ${
                    IconComponent ? "sk-input-with-icon" : ""
                  }`}
                />
              </div>
            );

          case "long_text":
            return (
              <textarea
                id={inputId}
                name={field.key}
                placeholder={field.placeholder ?? undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                rows={4}
                className="sk-input sk-textarea"
              />
            );

          case "email":
            return (
              <div className="sk-input-wrapper">
                {IconComponent && (
                  <IconComponent
                    className="sk-input-icon"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                )}
                <input
                  id={inputId}
                  name={field.key}
                  type="email"
                  inputMode="email"
                  placeholder={field.placeholder ?? undefined}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => onChange?.(e.target.value)}
                  disabled={disabled}
                  aria-invalid={!!error}
                  className={`sk-input ${
                    IconComponent ? "sk-input-with-icon" : ""
                  }`}
                />
              </div>
            );

          case "phone":
            return (
              <div className="sk-input-wrapper">
                {IconComponent && (
                  <IconComponent
                    className="sk-input-icon"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                )}
                <input
                  id={inputId}
                  name={field.key}
                  type="tel"
                  inputMode="tel"
                  placeholder={field.placeholder ?? undefined}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => onChange?.(e.target.value)}
                  disabled={disabled}
                  aria-invalid={!!error}
                  className={`sk-input ${
                    IconComponent ? "sk-input-with-icon" : ""
                  }`}
                />
              </div>
            );

          case "number":
            return (
              <div className="sk-input-wrapper">
                {IconComponent && (
                  <IconComponent
                    className="sk-input-icon"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                )}
                <input
                  id={inputId}
                  name={field.key}
                  type="number"
                  inputMode="numeric"
                  placeholder={field.placeholder ?? undefined}
                  value={
                    typeof value === "number" || typeof value === "string"
                      ? value
                      : ""
                  }
                  onChange={(e) => onChange?.(e.target.value)}
                  disabled={disabled}
                  aria-invalid={!!error}
                  className={`sk-input ${
                    IconComponent ? "sk-input-with-icon" : ""
                  }`}
                />
              </div>
            );

          case "date":
            return (
              <input
                id={inputId}
                name={field.key}
                type="date"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                className="sk-input"
              />
            );

          case "dropdown":
            return (
              <Select
                value={typeof value === "string" ? value : ""}
                onValueChange={(val) => onChange?.(val)}
                disabled={disabled}
              >
                <div className="sk-input-wrapper">
                  {IconComponent && (
                    <IconComponent
                      className="sk-input-icon"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  )}
                  <SelectPrimitive.Trigger
                    id={inputId}
                    aria-invalid={!!error}
                    className={`sk-select-trigger ${
                      IconComponent ? "sk-select-with-icon" : ""
                    }`}
                  >
                    <SelectPrimitive.Value
                      placeholder={field.placeholder || "Select an option..."}
                    />
                    <SelectPrimitive.Icon
                      render={
                        <ChevronDown
                          className="sk-select-chevron"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      }
                    />
                  </SelectPrimitive.Trigger>
                </div>
                <SelectContent className="bg-white border border-border rounded-lg shadow-[0_12px_32px_-8px_rgba(8,24,76,0.18)] p-1 max-h-70">
                  {options.map((opt, i) => (
                    <SelectItem
                      key={i}
                      value={opt}
                      className="h-10 rounded-md text-sm text-(--ink) focus:bg-(--primary-soft) focus:text-primary cursor-pointer"
                    >
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );

          case "radio":
            return (
              <fieldset className="space-y-1">
                <legend className="sr-only">{field.label}</legend>
                <div
                  className={`grid gap-2.5 grid-cols-1 ${
                    options.length >= 5 ? "sm:grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {options.map((opt, i) => {
                    const isSelected = value === opt;
                    const optId = `${inputId}-radio-${i}`;
                    return (
                      <label
                        key={i}
                        htmlFor={optId}
                        data-checked={isSelected}
                        className={`sk-option-card ${
                          isSelected ? "sk-option-selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          id={optId}
                          name={field.key}
                          value={opt}
                          checked={isSelected}
                          onChange={() => {
                            if (!disabled) onChange?.(opt);
                          }}
                          disabled={disabled}
                          className="sr-only"
                        />
                        {/* 18px Radio Indicator */}
                        <span
                          className={`size-4.5 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-primary border-[1.5px] bg-white"
                              : "border-(--border-hover) border-[1.5px] bg-white"
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected && (
                            <span className="size-2 rounded-full bg-primary" />
                          )}
                        </span>
                        <span className="text-[15px] font-medium text-(--ink) flex-1 leading-snug">
                          {opt}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );

          case "checkbox":
            return (
              <fieldset className="space-y-1">
                <legend className="sr-only">{field.label}</legend>
                <div
                  className={`grid gap-2.5 grid-cols-1 ${
                    options.length >= 5 ? "sm:grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {options.map((opt, i) => {
                    const selectedValues = Array.isArray(value) ? value : [];
                    const isChecked = selectedValues.includes(opt);
                    const chkId = `${inputId}-chk-${i}`;
                    return (
                      <label
                        key={i}
                        htmlFor={chkId}
                        data-checked={isChecked}
                        className={`sk-option-card ${
                          isChecked ? "sk-option-selected" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={chkId}
                          name={`${field.key}[]`}
                          value={opt}
                          checked={isChecked}
                          onChange={(e) => {
                            if (disabled) return;
                            if (e.target.checked) {
                              onChange?.([...selectedValues, opt]);
                            } else {
                              onChange?.(
                                selectedValues.filter((v: string) => v !== opt)
                              );
                            }
                          }}
                          disabled={disabled}
                          className="sr-only"
                        />
                        {/* 18px Checkbox Indicator with strict 4px radius */}
                        <span
                          style={{ borderRadius: "4px" }}
                          className={`size-4.5 shrink-0 border flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-primary border-primary"
                              : "border-(--border-hover) border-[1.5px] bg-white"
                          }`}
                          aria-hidden="true"
                        >
                          {isChecked && (
                            <Check className="size-3.5 text-white stroke-3" />
                          )}
                        </span>
                        <span className="text-[15px] font-medium text-(--ink) flex-1 leading-snug">
                          {opt}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );

          case "file":
            return (
              <FileFieldControl
                inputId={inputId}
                field={field}
                value={value}
                onChange={onChange}
                error={error}
                disabled={disabled}
                slug={slug}
                formId={formId}
                onUploadingChange={onUploadingChange}
              />
            );

          default:
            return null;
        }
      })()}

      {/* Error Message with Icon */}
      {error && (
        <p className="text-[13px] leading-4.5 text-(--danger-text) flex items-center gap-1.5 font-medium mt-1.5">
          <AlertCircle className="size-3.5 shrink-0 text-(--danger)" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
