"use client";

import { Pencil, Trash2, Lock, ChevronUp, ChevronDown } from "lucide-react";
import type { Field } from "@/types/form";
import { getFieldTypeMeta } from "./field-types-meta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FieldCardProps {
  field: Field;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isLocked: boolean;
  isReordering?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: (field: Field) => void;
  onDelete: (field: Field) => void;
}

export function FieldCard({
  field,
  index,
  isFirst,
  isLast,
  isLocked,
  isReordering = false,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: FieldCardProps) {
  const meta = getFieldTypeMeta(field.type);
  const Icon = meta.icon;

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-card hover:border-foreground/20 transition-all shadow-2xs">
      {/* Left side: Position, Icon, Label, Details */}
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <span className="text-xs font-semibold text-muted-foreground/60 w-5 text-right shrink-0 pt-0.5 sm:pt-0">
          {index + 1}
        </span>

        <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0 group-hover:text-foreground transition-colors">
          <Icon className="size-4" />
        </div>

        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground truncate">
              {field.label}
            </h4>
            {field.required && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                Required
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{meta.label}</span>
            {meta.isOptionType && (
              <>
                <span>•</span>
                <span>
                  {field.options?.length ?? 0} option
                  {(field.options?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </>
            )}
            <span>•</span>
            <span className="font-mono text-[11px] text-muted-foreground/80">
              key: {field.key}
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Reorder + Action buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
        {/* Reorder Buttons */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onMoveUp}
            disabled={isFirst || isReordering}
            aria-label="Move field up"
            title="Move field up"
            className="size-8 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onMoveDown}
            disabled={isLast || isReordering}
            aria-label="Move field down"
            title="Move field down"
            className="size-8 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(field)}
            className="gap-1.5 h-8 text-xs cursor-pointer"
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>

          {isLocked ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled
              className="gap-1.5 h-8 text-xs text-muted-foreground opacity-50 cursor-not-allowed"
              title="Fields cannot be deleted from a published form"
            >
              <Lock className="size-3.5" />
              Locked
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(field)}
              className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
