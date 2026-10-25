"use client";

import { UploadCloud } from "lucide-react";
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
  const inputId = `field-${field.id}`;
  const options = field.options ?? [];

  return (
    <div className="space-y-2">
      {/* Field Label with Required Asterisk */}
      <Label htmlFor={inputId} className="text-sm font-semibold flex items-center gap-1">
        <span>{field.label}</span>
        {field.required && (
          <span className="text-destructive font-bold" aria-hidden="true">
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
                type="text"
                placeholder={field.placeholder ?? undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                className="h-10"
              />
            );

          case "long_text":
            return (
              <Textarea
                id={inputId}
                placeholder={field.placeholder ?? undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                rows={4}
                className="resize-y min-h-[100px]"
              />
            );

          case "email":
            return (
              <Input
                id={inputId}
                type="email"
                inputMode="email"
                placeholder={field.placeholder ?? undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                className="h-10"
              />
            );

          case "phone":
            return (
              <Input
                id={inputId}
                type="tel"
                inputMode="tel"
                placeholder={field.placeholder ?? undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                className="h-10"
              />
            );

          case "number":
            return (
              <Input
                id={inputId}
                type="number"
                inputMode="numeric"
                placeholder={field.placeholder ?? undefined}
                value={typeof value === "number" || typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                className="h-10"
              />
            );

          case "date":
            return (
              <Input
                id={inputId}
                type="date"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={!!error}
                className="h-10"
              />
            );

          case "dropdown":
            return (
              <Select
                value={typeof value === "string" ? value : ""}
                onValueChange={(val) => onChange?.(val)}
                disabled={disabled}
              >
                <SelectTrigger id={inputId} className="w-full h-10">
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
                className="gap-2.5 pt-1"
              >
                {options.map((opt, i) => {
                  const optId = `${inputId}-radio-${i}`;
                  return (
                    <div key={i} className="flex items-center gap-2.5 py-1">
                      <RadioGroupItem value={opt} id={optId} />
                      <Label
                        htmlFor={optId}
                        className="text-sm font-normal text-foreground cursor-pointer select-none"
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
              <div className="space-y-2.5 pt-1">
                {options.map((opt, i) => {
                  const chkId = `${inputId}-chk-${i}`;
                  const selectedValues = Array.isArray(value) ? value : [];
                  const isChecked = selectedValues.includes(opt);

                  return (
                    <div key={i} className="flex items-center gap-2.5 py-1">
                      <Checkbox
                        id={chkId}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (disabled) return;
                          if (checked) {
                            onChange?.([...selectedValues, opt]);
                          } else {
                            onChange?.(selectedValues.filter((v: string) => v !== opt));
                          }
                        }}
                        disabled={disabled}
                      />
                      <Label
                        htmlFor={chkId}
                        className="text-sm font-normal text-foreground cursor-pointer select-none"
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
                <div className="flex items-center justify-between rounded-lg border border-dashed p-4 bg-muted/40 opacity-75 cursor-not-allowed">
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

      {/* Error Message */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
