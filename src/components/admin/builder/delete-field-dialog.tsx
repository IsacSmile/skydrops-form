"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import type { Field } from "@/types/form";
import { deleteFieldAction } from "@/app/admin/(protected)/forms/[id]/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteFieldDialogProps {
  formId: string;
  field: Field | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteFieldDialog({
  formId,
  field,
  open,
  onOpenChange,
  onDeleted,
}: DeleteFieldDialogProps) {
  const [isPending, startTransition] = useTransition();

  if (!field) return null;

  function handleDelete() {
    if (!field) return;

    startTransition(async () => {
      try {
        const res = await deleteFieldAction(formId, field.id);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Field "${field.label}" deleted`);
          onOpenChange(false);
          onDeleted?.();
        }
      } catch {
        toast.error("Failed to delete field");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            Delete field &ldquo;{field.label}&rdquo;?
          </DialogTitle>
          <DialogDescription className="text-left text-sm pt-2 space-y-2">
            <span>
              Are you sure you want to delete this field?
            </span>
            <span className="block font-medium text-foreground">
              Existing submissions will keep their data, but this field will disappear from the form and future submissions.
            </span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
