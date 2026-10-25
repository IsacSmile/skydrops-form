"use client";

import type { Form, Field } from "@/types/form";
import { BuilderHeader } from "./builder-header";
import { FieldList } from "./field-list";

interface FormBuilderProps {
  form: Form;
  fields: Field[];
}

export function FormBuilder({ form, fields }: FormBuilderProps) {
  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      <BuilderHeader form={form} />
      <FieldList form={form} fields={fields} />
    </div>
  );
}
