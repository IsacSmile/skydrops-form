"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Lock, Check } from "lucide-react";
import type { Form } from "@/types/form";
import { isStructureLocked } from "@/types/form";
import { updateFormDetailsAction } from "@/app/admin/(protected)/forms/[id]/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface BuilderHeaderProps {
  form: Form;
}

export function BuilderHeader({ form }: BuilderHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description ?? "");
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string[];
    description?: string[];
  }>({});

  const locked = isStructureLocked(form);
  const isDirty =
    title !== form.title || description !== (form.description ?? "");

  const badgeVariant =
    form.status === "published"
      ? "default"
      : form.status === "closed"
        ? "outline"
        : "secondary";

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    startTransition(async () => {
      try {
        const res = await updateFormDetailsAction(form.id, {
          title,
          description: description || null,
        });

        if (res.error) {
          if (res.fieldErrors) {
            setFieldErrors(res.fieldErrors);
          }
          toast.error(res.error);
        } else {
          toast.success("Form details saved");
          router.refresh();
        }
      } catch {
        toast.error("Failed to update form details");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Top navigation & status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to forms
        </Link>

        <div className="flex items-center gap-2">
          <Badge
            variant={badgeVariant}
            className={`capitalize ${
              form.status === "published"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : ""
            }`}
          >
            {form.status}
          </Badge>
          {locked && (
            <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40">
              <Lock className="size-3" />
              Structure locked
            </Badge>
          )}
        </div>
      </div>

      {/* Lock alert notice banner */}
      {locked && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <Lock className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-0.5">
            <p className="font-medium">Form structure is locked</p>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/80">
              This form has been published. You can add fields, rename labels and
              add options, but you can&apos;t delete fields or change types.
            </p>
          </div>
        </div>
      )}

      {/* Editable Title & Description Form */}
      <form
        onSubmit={handleSave}
        className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="form-title" className="text-sm font-semibold">
            Form title *
          </Label>
          <Input
            id="form-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            disabled={isPending}
            className="text-lg font-semibold h-11"
            placeholder="e.g. Customer Feedback Survey"
            aria-invalid={!!fieldErrors.title}
          />
          {fieldErrors.title && (
            <p className="text-xs text-destructive">
              {fieldErrors.title.join(", ")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="form-description"
            className="text-xs text-muted-foreground font-medium"
          >
            Description (optional)
          </Label>
          <Textarea
            id="form-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            disabled={isPending}
            placeholder="Give your respondents instructions or context..."
            className="text-sm resize-none"
            aria-invalid={!!fieldErrors.description}
          />
          {fieldErrors.description && (
            <p className="text-xs text-destructive">
              {fieldErrors.description.join(", ")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {isDirty && (
            <span className="text-xs text-muted-foreground mr-auto">
              Unsaved changes
            </span>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !isDirty}
            className="gap-1.5"
          >
            <Check className="size-3.5" />
            {isPending ? "Saving..." : "Save details"}
          </Button>
        </div>
      </form>
    </div>
  );
}
