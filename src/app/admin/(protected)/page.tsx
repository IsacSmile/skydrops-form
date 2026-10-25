import { listForms } from "@/lib/forms-data";
import { FormsManager } from "@/components/admin/forms-manager";

export const instant = false;

export default async function AdminFormsPage() {
  const forms = await listForms();

  return <FormsManager forms={forms} />;
}
