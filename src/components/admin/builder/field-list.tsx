"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Layers, AlertCircle } from "lucide-react";
import { type Form, type Field, isStructureLocked } from "@/types/form";
import { FieldCard } from "./field-card";
import { FieldDialog } from "./field-dialog";
import { DeleteFieldDialog } from "./delete-field-dialog";
import { Button } from "@/components/ui/button";

interface FieldListProps {
  form: Form;
  fields: Field[];
}

export function FieldList({ form, fields }: FieldListProps) {
  const router = useRouter();
  const locked = isStructureLocked(form);

  // Dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [deletingField, setDeletingField] = useState<Field | null>(null);

  const isLimitReached = fields.length >= 50;

  function handleRefresh() {
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight">Form Fields</h2>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {fields.length} / 50
          </span>
        </div>

        <Button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={isLimitReached}
          className="gap-2"
        >
          <Plus className="size-4" />
          Add field
        </Button>
      </div>

      {isLimitReached && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>Maximum of 50 fields per form has been reached.</span>
        </div>
      )}

      {/* Field Items or Empty State */}
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed bg-muted/20 space-y-4">
          <div className="p-3 bg-muted rounded-full">
            <Layers className="size-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-base">No fields yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Add your first field to start collecting responses from your users.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Add your first field
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {fields.map((field, idx) => (
            <FieldCard
              key={field.id}
              field={field}
              index={idx}
              isLocked={locked}
              onEdit={(f) => setEditingField(f)}
              onDelete={(f) => setDeletingField(f)}
            />
          ))}
        </div>
      )}

      {/* Add Field Dialog */}
      <FieldDialog
        formId={form.id}
        field={null}
        open={addOpen}
        onOpenChange={setAddOpen}
        isLocked={locked}
        onSuccess={handleRefresh}
      />

      {/* Edit Field Dialog */}
      <FieldDialog
        formId={form.id}
        field={editingField}
        open={!!editingField}
        onOpenChange={(open) => {
          if (!open) setEditingField(null);
        }}
        isLocked={locked}
        onSuccess={handleRefresh}
      />

      {/* Delete Field Confirmation Dialog */}
      <DeleteFieldDialog
        formId={form.id}
        field={deletingField}
        open={!!deletingField}
        onOpenChange={(open) => {
          if (!open) setDeletingField(null);
        }}
        onDeleted={handleRefresh}
      />
    </div>
  );
}
