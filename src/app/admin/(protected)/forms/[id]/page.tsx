import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getForm } from "@/lib/forms-data";
import { listFields } from "@/lib/fields-data";
import { getSubmissionStats } from "@/lib/submissions-data";
import { getAppOrigin } from "@/lib/short-link";
import { isFileUploadsEnabled } from "@/lib/feature-flags";
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

  const [fields, origin, stats] = await Promise.all([
    listFields(id),
    getAppOrigin(),
    getSubmissionStats(id),
  ]);

  const fileUploadsEnabled = isFileUploadsEnabled();

  return (
    <FormBuilder
      form={form}
      fields={fields}
      origin={origin}
      submissionsCount={stats.total}
      fileUploadsEnabled={fileUploadsEnabled}
    />
  );
}
