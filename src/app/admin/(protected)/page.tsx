import { connection } from "next/server";
import { listForms } from "@/lib/forms-data";
import { FormsManager } from "@/components/admin/forms-manager";

export const instant = false;

export default async function AdminFormsPage() {
  await connection();
  const forms = await listForms();

  return <FormsManager forms={forms} />;
}
