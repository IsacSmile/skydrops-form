"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Lock, Info } from "lucide-react";
import type { Field, FieldType } from "@/types/form";
import {
  ORDERED_FIELD_TYPES,
  FIELD_TYPES_META,
} from "./field-types-meta";
import { isOptionFieldType, isTextLikeFieldType } from "@/lib/field-validation";
import {
  addFieldAction,
  updateFieldAction,
} from "@/app/admin/(protected)/forms/[id]/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface FieldDialogProps {
  formId: string;
  field: Field | null; // null = Add, non-null = Edit
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLocked: boolean;
  onSuccess?: () => void;
}

interface FieldFormInnerProps {
  formId: string;
  field: Field | null;
  isLocked: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function FieldFormInner({
  formId,
  field,
  isLocked,
  onClose,
  onSuccess,
}: FieldFormInnerProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!field;

  // Initialize state directly from field props - no effect needed
  const [type, setType] = useState<FieldType>(field?.type ?? "short_text");
  const [label, setLabel] = useState(field?.label ?? "");
  const [required, setRequired] = useState(field?.required ?? false);
  const [placeholder, setPlaceholder] = useState(field?.placeholder ?? "");
  const [options, setOptions] = useState<string[]>(field?.options ?? []);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Number of original locked options (if editing a locked form's option field)
  const lockedOptionsCount =
    isEditing && isLocked && field?.options ? field.options.length : 0;

  function handleTypeChange(newType: FieldType) {
    if (isEditing && isLocked) return;
    setType(newType);
    setErrors({});

    // Set initial options if switching to option field with empty options
    if (isOptionFieldType(newType) && options.length === 0) {
      if (newType === "checkbox") {
        setOptions(["Option 1"]);
      } else {
        setOptions(["Option 1", "Option 2"]);
      }
    }
  }

  function handleAddOption() {
    setOptions((prev) => [...prev, `Option ${prev.length + 1}`]);
  }

  function handleOptionChange(index: number, val: string) {
    if (isEditing && isLocked && index < lockedOptionsCount) return;
    setOptions((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  }

  function handleRemoveOption(index: number) {
    if (isEditing && isLocked && index < lockedOptionsCount) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const payload = {
      label,
      type,
      required,
      placeholder: isTextLikeFieldType(type) ? placeholder || null : null,
      options: isOptionFieldType(type) ? options : [],
    };

    startTransition(async () => {
      try {
        const res = isEditing
          ? await updateFieldAction(formId, field.id, payload)
          : await addFieldAction(formId, payload);

        if (res.error) {
          if (res.fieldErrors) {
            setErrors(res.fieldErrors);
          }
          toast.error(res.error);
        } else {
          toast.success(
            isEditing
              ? `Field "${label}" updated`
              : `Field "${label}" added`
          );
          onClose();
          onSuccess?.();
        }
      } catch {
        toast.error("Failed to save field. Please check your connection.");
      }
    });
  }

  const isTextLike = isTextLikeFieldType(type);
  const isOptionType = isOptionFieldType(type);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>
          {isEditing ? `Edit field: ${field.label}` : "Add new field"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Configure this field's settings."
            : "Choose a field type and customize its label and validation."}
        </DialogDescription>
      </DialogHeader>

      {/* Field Type Selector */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Field type</Label>
          {isEditing && isLocked && (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <Lock className="size-3" />
              Type locked (published form)
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ORDERED_FIELD_TYPES.map((t) => {
            const meta = FIELD_TYPES_META[t];
            const Icon = meta.icon;
            const isSelected = type === t;
            const disabled = isEditing && isLocked;

            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => handleTypeChange(t)}
                className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-medium ring-2 ring-primary/20 shadow-xs"
                    : "border-border hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <Icon className="size-5 shrink-0" />
                <span className="text-xs leading-tight line-clamp-2">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
        {errors["type"] && (
          <p className="text-xs text-destructive">
            {errors["type"].join(", ")}
          </p>
        )}
      </div>

      {/* Label Input */}
      <div className="space-y-2">
        <Label htmlFor="field-label" className="text-sm font-semibold">
          Label *
        </Label>
        <Input
          id="field-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. What is your full name?"
          maxLength={120}
          required
          disabled={isPending}
          aria-invalid={!!errors["label"]}
        />
        {errors["label"] && (
          <p className="text-xs text-destructive">
            {errors["label"].join(", ")}
          </p>
        )}
      </div>

      {/* Placeholder (Text-like types only) */}
      {isTextLike && (
        <div className="space-y-2">
          <Label
            htmlFor="field-placeholder"
            className="text-xs text-muted-foreground font-medium"
          >
            Placeholder text (optional)
          </Label>
          <Input
            id="field-placeholder"
            value={placeholder}
            onChange={(e) => setPlaceholder(e.target.value)}
            placeholder="e.g. Jane Doe"
            maxLength={200}
            disabled={isPending}
            aria-invalid={!!errors["placeholder"]}
          />
          {errors["placeholder"] && (
            <p className="text-xs text-destructive">
              {errors["placeholder"].join(", ")}
            </p>
          )}
        </div>
      )}

      {/* File Upload Notice */}
      {type === "file" && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/60 border text-xs text-muted-foreground">
          <Info className="size-4 shrink-0 text-muted-foreground" />
          <span>Respondents will upload a file (set up later).</span>
        </div>
      )}

      {/* Options Editor (Dropdown, Radio, Checkbox) */}
      {isOptionType && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">Options</Label>
              <p className="text-xs text-muted-foreground">
                {type === "checkbox"
                  ? "Minimum 1 option required"
                  : "Minimum 2 options required"}
              </p>
            </div>
            {isEditing && isLocked && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Lock className="size-3" />
                Existing options locked (append-only)
              </span>
            )}
          </div>

          {errors["options"] && (
            <p className="text-xs text-destructive">
              {errors["options"].join(", ")}
            </p>
          )}

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {options.map((opt, idx) => {
              const isExistingLocked =
                isEditing && isLocked && idx < lockedOptionsCount;

              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                    {idx + 1}.
                  </span>
                  <Input
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    maxLength={100}
                    disabled={isPending || isExistingLocked}
                    className={isExistingLocked ? "bg-muted cursor-not-allowed" : ""}
                    aria-invalid={!!errors[`options.${idx}`]}
                  />
                  {isExistingLocked ? (
                    <div
                      className="size-8 flex items-center justify-center shrink-0 text-muted-foreground"
                      title="Existing option is locked"
                    >
                      <Lock className="size-3.5" />
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(idx)}
                      disabled={isPending}
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove option</span>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {options.length < 50 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddOption}
              disabled={isPending}
              className="gap-1.5 text-xs w-full sm:w-auto"
            >
              <Plus className="size-3.5" />
              Add option
            </Button>
          )}
        </div>
      )}

      {/* Required switch */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="required-toggle" className="text-sm font-medium cursor-pointer">
            Required field
          </Label>
          <p className="text-xs text-muted-foreground">
            Respondents must fill or select this field before submitting
          </p>
        </div>
        <Switch
          id="required-toggle"
          checked={required}
          onCheckedChange={setRequired}
          disabled={isPending}
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-0 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? isEditing
              ? "Saving..."
              : "Adding..."
            : isEditing
              ? "Save changes"
              : "Add field"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FieldDialog({
  formId,
  field,
  open,
  onOpenChange,
  isLocked,
  onSuccess,
}: FieldDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {open && (
          <FieldFormInner
            key={`${field?.id ?? "new"}-${open}`}
            formId={formId}
            field={field}
            isLocked={isLocked}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
