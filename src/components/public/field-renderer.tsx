"use client";

import { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import type { Field } from "@/types/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  ACCEPT_ATTR,
  buildUploadPrefix,
  sanitizeFileName,
  isAllowedFile,
} from "@/lib/upload-policy";

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

  // Sync state when external value changes (e.g. form reset or prefilled value)
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
        <div className="flex items-center justify-between rounded-xl border border-dashed p-4 bg-muted/40 opacity-75 cursor-not-allowed min-h-14">
          <div className="flex items-center gap-3">
            <UploadCloud className="size-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">
              Choose a file
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" disabled>
            Browse
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Respondents will upload a file (max 5 MB)
        </p>
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
      setErrorMessage("Upload failed. Please try again.");
      setStatus("error");
    } finally {
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
        <div className="p-4 rounded-xl border border-[#DCE6F5] bg-card space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5B6475]">
            <span className="font-medium text-[#111014] truncate max-w-[200px] sm:max-w-xs">
              Uploading {fileMeta?.name}...
            </span>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-[#0B5BFF]">
                {Math.round(progress)}%
              </span>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs font-semibold text-[#5B6475] hover:text-[#D92D20] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="w-full bg-[#E5EEFF] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-[#0B5BFF] transition-all duration-150 ease-out rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}

      {/* Uploaded State */}
      {status === "uploaded" && (
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#DCE6F5] bg-[#F4F8FF]/50">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <CheckCircle2 className="size-5 text-[#0B5BFF] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#111014] truncate">
                {fileMeta?.name ?? "Uploaded file"}
              </p>
              {fileMeta?.size && (
                <p className="text-xs text-[#5B6475]">
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
              className="text-xs font-semibold text-[#0B5BFF] hover:underline cursor-pointer disabled:opacity-50"
            >
              Replace
            </button>
            <span className="text-[#DCE6F5]" aria-hidden="true">
              |
            </span>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="text-xs font-semibold text-[#D92D20] hover:underline cursor-pointer disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="p-3.5 rounded-xl border border-[#D92D20]/30 bg-[#D92D20]/5 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-[#D92D20] shrink-0 mt-0.5" />
              <span className="text-xs text-[#D92D20] font-medium leading-relaxed">
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
              className="text-xs font-semibold text-[#0B5BFF] hover:underline shrink-0 cursor-pointer"
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
          className={`min-h-14 rounded-xl border border-dashed p-4 flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer transition-colors ${
            isDragging
              ? "border-[#0B5BFF] bg-[#F4F8FF]"
              : "border-[#DCE6F5] bg-card hover:bg-[#F4F8FF]/40"
          } ${error ? "border-destructive" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#E5EEFF] text-[#0B5BFF]">
              <UploadCloud className="size-5" />
            </div>
            <div>
              <span className="text-sm font-semibold text-[#111014] block">
                Choose a file
              </span>
              <span className="text-xs text-[#5B6475]">
                JPG, PNG, WebP, PDF, DOC or DOCX &bull; Max 5 MB
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg text-xs font-semibold border-[#DCE6F5] text-[#111014] pointer-events-none"
            tabIndex={-1}
          >
            Browse
          </Button>
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

  const inputBaseClasses = `h-12 text-base rounded-xl transition-colors bg-background border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary ${
    error ? "border-destructive text-foreground" : ""
  }`;

  return (
    <div className="space-y-2">
      {/* Field Label with Required Asterisk */}
      <Label
        htmlFor={inputId}
        className="text-sm font-semibold text-foreground flex items-center gap-0.5"
      >
        <span>{field.label}</span>
        {field.required && (
          <span className="text-destructive font-bold ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </Label>

      {/* Field Input Control by Type */}
      {(() => {
        switch (field.type) {
          case "short_text":
            return (
              <Input
                id={inputId}
                name={field.key}
                type="text"
                placeholder={field.placeholder ?? undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                className={inputBaseClasses}
              />
            );

          case "long_text":
            return (
              <Textarea
                id={inputId}
                name={field.key}
                placeholder={field.placeholder ?? undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                rows={4}
                className={`resize-y min-h-25 text-base rounded-xl p-3 bg-background border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary ${
                  error ? "border-destructive" : ""
                }`}
              />
            );

          case "email":
            return (
              <Input
                id={inputId}
                name={field.key}
                type="email"
                inputMode="email"
                placeholder={field.placeholder ?? undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                className={inputBaseClasses}
              />
            );

          case "phone":
            return (
              <Input
                id={inputId}
                name={field.key}
                type="tel"
                inputMode="tel"
                placeholder={field.placeholder ?? undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                className={inputBaseClasses}
              />
            );

          case "number":
            return (
              <Input
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
                className={inputBaseClasses}
              />
            );

          case "date":
            return (
              <Input
                id={inputId}
                name={field.key}
                type="date"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                className={inputBaseClasses}
              />
            );

          case "dropdown":
            return (
              <Select
                value={typeof value === "string" ? value : ""}
                onValueChange={(val) => onChange?.(val)}
                disabled={disabled}
              >
                <SelectTrigger
                  id={inputId}
                  className={`w-full h-12 text-base rounded-xl bg-background border-input focus:ring-2 focus:ring-ring focus:border-primary ${
                    error ? "border-destructive" : ""
                  }`}
                >
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt, i) => (
                    <SelectItem key={i} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );

          case "radio":
            return (
              <RadioGroup
                value={typeof value === "string" ? value : ""}
                onValueChange={(val) => onChange?.(val)}
                disabled={disabled}
                className="gap-1 pt-1"
              >
                {options.map((opt, i) => {
                  const optId = `${inputId}-radio-${i}`;
                  return (
                    <div
                      key={i}
                      className="min-h-11 flex items-center gap-3 py-1 cursor-pointer"
                    >
                      <RadioGroupItem value={opt} id={optId} />
                      <Label
                        htmlFor={optId}
                        className="text-base sm:text-sm font-normal text-foreground cursor-pointer select-none leading-none"
                      >
                        {opt}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            );

          case "checkbox":
            return (
              <div className="space-y-1 pt-1">
                {options.map((opt, i) => {
                  const chkId = `${inputId}-chk-${i}`;
                  const selectedValues = Array.isArray(value) ? value : [];
                  const isChecked = selectedValues.includes(opt);

                  return (
                    <div
                      key={i}
                      className="min-h-11 flex items-center gap-3 py-1 cursor-pointer"
                    >
                      <Checkbox
                        id={chkId}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (disabled) return;
                          if (checked) {
                            onChange?.([...selectedValues, opt]);
                          } else {
                            onChange?.(
                              selectedValues.filter((v: string) => v !== opt)
                            );
                          }
                        }}
                        disabled={disabled}
                      />
                      <Label
                        htmlFor={chkId}
                        className="text-base sm:text-sm font-normal text-foreground cursor-pointer select-none leading-none"
                      >
                        {opt}
                      </Label>
                    </div>
                  );
                })}
              </div>
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
        <p className="text-[13px] text-destructive flex items-center gap-1.5 font-medium mt-1.5">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
