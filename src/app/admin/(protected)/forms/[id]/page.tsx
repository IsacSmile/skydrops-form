import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getForm } from "@/lib/forms-data";
import { listFields } from "@/lib/fields-data";
import { FormBuilder } from "@/components/admin/builder/form-builder";

export const instant = false;

interface FormPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminFormBuilderPage({
  params,
}: FormPageProps) {
  await connection();
  const { id } = await params;
  const form = await getForm(id);

  if (!form) {
    notFound();
  }

  const fields = await listFields(id);

  return <FormBuilder form={form} fields={fields} />;
}
