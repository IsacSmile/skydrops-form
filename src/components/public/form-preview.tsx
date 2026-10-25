"use client";

import { useState } from "react";
import type { Form, Field } from "@/types/form";
import { FieldRenderer } from "./field-renderer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

interface FormPreviewProps {
  form: Form;
  fields: Field[];
}

export function FormPreview({ form, fields }: FormPreviewProps) {
  // Local throwaway state for interactive preview
  const [values, setValues] = useState<Record<string, unknown>>({});

  function handleFieldChange(fieldId: string, val: unknown) {
    setValues((prev) => ({
      ...prev,
      [fieldId]: val,
    }));
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Live Form Preview Card */}
      <Card className="shadow-xs border bg-card">
        <CardHeader className="space-y-2 pb-6 border-b">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {form.title || "Untitled Form"}
          </CardTitle>
          {form.description && (
            <CardDescription className="text-sm whitespace-pre-wrap leading-relaxed">
              {form.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-3">
              <div className="p-3 bg-muted rounded-full">
                <Layers className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No fields yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Add fields in the Build tab to preview how respondents will experience your form.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  onChange={(val) => handleFieldChange(field.id, val)}
                  disabled={false}
                />
              ))}

              <div className="pt-4 border-t">
                <Button
                  type="button"
                  disabled
                  className="w-full sm:w-auto px-8 font-semibold cursor-not-allowed opacity-80"
                >
                  Submit
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
