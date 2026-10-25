"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Hammer, Eye, Lock } from "lucide-react";
import type { Form, Field } from "@/types/form";
import { isStructureLocked } from "@/types/form";
import { reorderFieldsAction } from "@/app/admin/(protected)/forms/[id]/actions";
import { BuilderHeader } from "./builder-header";
import { PublishingCard } from "./publishing-card";
import { FieldList } from "./field-list";
import { FormPreview } from "@/components/public/form-preview";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface FormBuilderProps {
  form: Form;
  fields: Field[];
  origin: string;
}

export function FormBuilder({ form, fields, origin }: FormBuilderProps) {
  // Optimistic fields state synced with server props
  const [fieldsState, setFieldsState] = useState(fields);
  const [prevFields, setPrevFields] = useState(fields);
  const [isReordering, setIsReordering] = useState(false);

  // Sync state when server revalidates
  if (fields !== prevFields) {
    setPrevFields(fields);
    setFieldsState(fields);
  }

  const locked = isStructureLocked(form);
  const badgeVariant =
    form.status === "published"
      ? "default"
      : form.status === "closed"
        ? "outline"
        : "secondary";

  async function handleReorder(newFields: Field[]) {
    const previous = fieldsState;
    // Optimistic update
    setFieldsState(newFields);
    setIsReordering(true);

    try {
      const res = await reorderFieldsAction(
        form.id,
        newFields.map((f) => f.id)
      );

      if (res.error) {
        setFieldsState(previous);
        toast.error(res.error);
      } else {
        toast.success("Field order updated");
      }
    } catch {
      setFieldsState(previous);
      toast.error("Failed to reorder fields. Please try again.");
    } finally {
      setIsReordering(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <Tabs defaultValue="build" className="w-full space-y-6">
        {/* Top Header & Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to forms
          </Link>

          {/* Build | Preview Tabs Switcher */}
          <TabsList className="h-9 w-full sm:w-auto grid grid-cols-2">
            <TabsTrigger value="build" className="gap-2 px-4 cursor-pointer">
              <Hammer className="size-3.5" />
              Build
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2 px-4 cursor-pointer">
              <Eye className="size-3.5" />
              Preview
            </TabsTrigger>
          </TabsList>

          {/* Form Status & Lock Badges */}
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
              <Badge
                variant="outline"
                className="gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40"
              >
                <Lock className="size-3" />
                Structure locked
              </Badge>
            )}
          </div>
        </div>

        {/* Tab 1: Build Mode */}
        <TabsContent value="build" className="space-y-6 outline-none">
          <PublishingCard
            form={form}
            fieldsCount={fieldsState.length}
            origin={origin}
          />
          <BuilderHeader form={form} />
          <FieldList
            form={form}
            fields={fieldsState}
            onReorder={handleReorder}
            isReordering={isReordering}
          />
        </TabsContent>

        {/* Tab 2: Live Preview Mode */}
        <TabsContent value="preview" keepMounted className="space-y-4 outline-none">
          <div className="text-center py-1">
            <span className="text-xs text-muted-foreground bg-muted/80 border rounded-full px-3.5 py-1.5 font-medium inline-block shadow-2xs">
              Preview only. Nothing here is submitted.
            </span>
          </div>
          <FormPreview form={form} fields={fieldsState} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
