import { connection } from "next/server";
import { listForms } from "@/lib/forms-data";
import { getAppOrigin } from "@/lib/short-link";
import { FormsManager } from "@/components/admin/forms-manager";

export const instant = false;

export default async function AdminFormsPage() {
  await connection();
  const [forms, origin] = await Promise.all([
    listForms(),
    getAppOrigin(),
  ]);

  return <FormsManager forms={forms} origin={origin} />;
}
