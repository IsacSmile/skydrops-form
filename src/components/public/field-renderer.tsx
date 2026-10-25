"use client";

import { UploadCloud, AlertCircle } from "lucide-react";
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

export interface FieldRendererProps {
  field: Field;
  value?: unknown;
  onChange?: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export function FieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled = false,
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
                      className="min-h-[44px] flex items-center gap-3 py-1 cursor-pointer"
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
                      className="min-h-[44px] flex items-center gap-3 py-1 cursor-pointer"
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-xl border border-dashed p-4 bg-muted/40 opacity-75 cursor-not-allowed">
                  <div className="flex items-center gap-3">
                    <UploadCloud className="size-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground font-medium">
                      Choose file to upload
                    </span>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled>
                    Browse
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  File upload is enabled after setup
                </p>
              </div>
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
