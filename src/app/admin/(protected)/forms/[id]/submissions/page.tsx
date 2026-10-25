import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getForm } from "@/lib/forms-data";
import { listFields } from "@/lib/fields-data";
import {
  getSubmissionStats,
  listSubmissions,
  isValidUuid,
} from "@/lib/submissions-data";
import { isRetryable } from "@/lib/sheets-sync";
import { getSheetUrl, getAppOrigin } from "@/lib/short-link";
import { SubmissionsManager } from "@/components/admin/submissions/submissions-manager";

export const instant = false;

interface SubmissionsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminFormSubmissionsPage({
  params,
  searchParams,
}: SubmissionsPageProps) {
  await connection();
  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  const { page: rawPage } = await searchParams;
  const parsedPage = rawPage ? parseInt(rawPage, 10) : 1;
  const requestedPage = Number.isNaN(parsedPage) ? 1 : parsedPage;

  const [form, fields, stats, origin] = await Promise.all([
    getForm(id),
    listFields(id),
    getSubmissionStats(id),
    getAppOrigin(),
  ]);

  if (!form) {
    notFound();
  }

  const submissions = await listSubmissions(id, {
    page: requestedPage,
    pageSize: 25,
  });

  const googleSheetId = process.env.GOOGLE_SHEET_ID;
  const sheetUrl = getSheetUrl(googleSheetId, form.sheetGid);
  const now = new Date();

  const augmentedSubmissions = {
    ...submissions,
    rows: submissions.rows.map((row) => ({
      ...row,
      isRetryable: isRetryable(row, now),
    })),
  };

  return (
    <SubmissionsManager
      form={form}
      fields={fields}
      stats={stats}
      submissions={augmentedSubmissions}
      sheetUrl={sheetUrl}
      origin={origin}
    />
  );
}
