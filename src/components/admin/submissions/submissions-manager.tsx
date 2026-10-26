"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Inbox,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import type { Form, Field, SyncStatus } from "@/types/form";
import { buildShortLink } from "@/lib/short-link";
import { copyToClipboard } from "@/lib/clipboard";
import { formatResponseDate } from "@/lib/sheet-format";
import {
  retrySubmissionAction,
  retryFailedAction,
} from "@/app/admin/(protected)/forms/[id]/submissions/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface SubmissionRowItem {
  id: string;
  createdAt: Date | string;
  data: Record<string, unknown>;
  syncStatus: SyncStatus;
  syncAttempts: number;
  syncError: string | null;
  syncedAt: Date | string | null;
  isRetryable: boolean;
}

export interface SubmissionsManagerProps {
  form: Form;
  fields: Field[];
  stats: {
    total: number;
    synced: number;
    pending: number;
    failed: number;
  };
  submissions: {
    rows: SubmissionRowItem[];
    total: number;
    page: number;
    pageCount: number;
  };
  sheetUrl: string | null;
  origin: string;
}

function formatAnswerValue(val: unknown): string {
  if (val === null || val === undefined || val === "") {
    return "—";
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return "—";
    return val.map((v) => String(v ?? "")).join(", ");
  }
  return String(val);
}

function truncateString(str: string, maxLength: number = 60): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

function isValidHttpsUrl(str: unknown): boolean {
  if (typeof str !== "string") return false;
  try {
    const u = new URL(str.trim());
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseBlobFileName(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);
    const last = pathname.split("/").filter(Boolean).pop() || "";
    const match = last.match(/^(.*)-[A-Za-z0-9_-]{8,}\.([a-zA-Z0-9]+)$/);
    if (match) {
      return `${match[1]}.${match[2]}`;
    }
    return last || "file";
  } catch {
    return "file";
  }
}

interface FormattedAnswer {
  key: string;
  label: string;
  value: string;
  fieldType?: string;
  fileUrl?: string | null;
  fileName?: string | null;
}

function getSubmissionAnswers(
  data: Record<string, unknown> | null | undefined,
  fields: Field[]
): FormattedAnswer[] {
  const answers = data || {};
  const seenKeys = new Set<string>();
  const results: FormattedAnswer[] = [];
  const fieldMap = new Map(fields.map((f) => [f.key, f]));

  for (const field of fields) {
    seenKeys.add(field.key);
    if (field.key in answers) {
      const raw = answers[field.key];
      const isFile = field.type === "file";
      const isHttps = isValidHttpsUrl(raw);
      const urlStr = typeof raw === "string" ? raw.trim() : "";

      results.push({
        key: field.key,
        label: field.label || field.key,
        value: formatAnswerValue(raw),
        fieldType: field.type,
        fileUrl: isFile && isHttps ? urlStr : null,
        fileName: isFile && isHttps ? parseBlobFileName(urlStr) : null,
      });
    }
  }

  for (const [key, raw] of Object.entries(answers)) {
    if (!seenKeys.has(key)) {
      const field = fieldMap.get(key);
      const isFile = field?.type === "file";
      const isHttps = isValidHttpsUrl(raw);
      const urlStr = typeof raw === "string" ? raw.trim() : "";

      results.push({
        key,
        label: field?.label || key,
        value: formatAnswerValue(raw),
        fieldType: field?.type || "unknown",
        fileUrl: isFile && isHttps ? urlStr : null,
        fileName: isFile && isHttps ? parseBlobFileName(urlStr) : null,
      });
    }
  }

  return results;
}

export function SubmissionsManager({
  form,
  fields,
  stats,
  submissions,
  sheetUrl,
  origin,
}: SubmissionsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [retryingRowId, setRetryingRowId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [detailSubmission, setDetailSubmission] = useState<SubmissionRowItem | null>(null);

  const shortLink = buildShortLink(form.slug, origin);
  const hasRetryableRows =
    stats.failed > 0 || submissions.rows.some((r) => r.isRetryable);

  async function handleCopy() {
    const ok = await copyToClipboard(shortLink);
    if (ok) {
      setCopiedLink(true);
      toast.success("Short link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      toast.error("Failed to copy link");
    }
  }

  async function handleRetryRow(submissionId: string) {
    setRetryingRowId(submissionId);
    try {
      const res = await retrySubmissionAction(form.id, submissionId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.data?.message || "Submission synced successfully!");
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      toast.error("Failed to retry submission.");
    } finally {
      setRetryingRowId(null);
    }
  }

  async function handleRetryAll() {
    setIsRetryingAll(true);
    try {
      const res = await retryFailedAction(form.id);
      if (res.error) {
        toast.error(res.error);
      } else if (res.data) {
        const { attempted, synced, failed } = res.data;
        toast.success(
          `Retried ${attempted}: ${synced} synced, ${failed} still failing`
        );
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      toast.error("Failed to retry failed submissions.");
    } finally {
      setIsRetryingAll(false);
    }
  }

  const detailAnswers = detailSubmission
    ? getSubmissionAnswers(detailSubmission.data, fields)
    : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href={`/admin/forms/${form.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to builder
          </Link>
          <div className="flex flex-wrap items-center gap-3 pt-0.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {form.title}
            </h1>
            <Badge
              variant={
                form.status === "published"
                  ? "default"
                  : form.status === "closed"
                    ? "outline"
                    : "secondary"
              }
              className={`capitalize text-xs ${
                form.status === "published"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : ""
              }`}
            >
              {form.status}
            </Badge>
          </div>
        </div>

        {/* Action button / Sheet link */}
        <div className="flex items-center">
          {sheetUrl ? (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "gap-2 font-medium border-primary/30 text-foreground hover:bg-primary/5",
              })}
            >
              <ExternalLink className="size-4 text-primary" />
              Open Google Sheet
            </a>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              Sheet tab is created on the first response
            </span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Card */}
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Total</span>
              <Inbox className="size-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats.total}
            </div>
          </CardContent>
        </Card>

        {/* Synced Card */}
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Synced</span>
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.synced}
            </div>
          </CardContent>
        </Card>

        {/* Pending Card */}
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Pending</span>
              <Clock className="size-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats.pending}
            </div>
          </CardContent>
        </Card>

        {/* Failed Card */}
        <Card
          className={
            stats.failed > 0
              ? "border-destructive/40 bg-destructive/5 dark:bg-destructive/10"
              : ""
          }
        >
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium">
              <span
                className={
                  stats.failed > 0
                    ? "text-destructive font-semibold"
                    : "text-muted-foreground"
                }
              >
                Failed
              </span>
              <AlertCircle
                className={`size-4 ${
                  stats.failed > 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              />
            </div>
            <div
              className={`text-2xl font-bold ${
                stats.failed > 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {stats.failed}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Retry All Banner (when failed > 0 or retryable pending > 0) */}
      {hasRetryableRows && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {stats.failed > 0
                  ? `${stats.failed} response${stats.failed === 1 ? "" : "s"} failed to sync`
                  : "Some responses are pending sync"}
              </p>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                Failed rows are safe in the database and retrying will not create duplicates.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleRetryAll}
            disabled={isRetryingAll || isPending}
            className="gap-2 shrink-0 bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
          >
            <RefreshCw
              className={`size-3.5 ${isRetryingAll ? "animate-spin" : ""}`}
            />
            {isRetryingAll ? "Retrying..." : "Retry all failed"}
          </Button>
        </div>
      )}

      {/* Main Content Area */}
      {submissions.rows.length === 0 ? (
        /* Empty State */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="p-3 bg-muted rounded-full">
              <Inbox className="size-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-foreground">
                No responses yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Share your link to start collecting responses.
              </p>
            </div>

            {form.status === "published" && (
              <div className="w-full max-w-md pt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={shortLink}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="font-mono text-xs select-all bg-muted/40"
                    aria-label="Public short link"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="gap-1.5 shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-45">Submitted</TableHead>
                  <TableHead className="w-[45%]">Answers Preview</TableHead>
                  <TableHead className="w-35">Sync Status</TableHead>
                  <TableHead>Sync Details</TableHead>
                  <TableHead className="text-right w-35">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.rows.map((row) => {
                  const answers = getSubmissionAnswers(row.data, fields);
                  const preview = answers.slice(0, 3);
                  const isRetrying = retryingRowId === row.id;

                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setDetailSubmission(row)}
                    >
                      {/* Submitted date */}
                      <TableCell className="font-medium text-xs whitespace-nowrap text-foreground">
                        {formatResponseDate(row.createdAt)}
                      </TableCell>

                      {/* First 3 answers preview */}
                      <TableCell>
                        <div className="space-y-1 max-w-lg">
                          {preview.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">
                              No answers recorded
                            </span>
                          ) : (
                            preview.map((ans, idx) => (
                              <div
                                key={idx}
                                className="text-xs leading-snug truncate"
                              >
                                <span className="font-medium text-foreground">
                                  {ans.label}:
                                </span>{" "}
                                {ans.fieldType === "file" && ans.fileUrl ? (
                                  <a
                                    href={ans.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                                  >
                                    <span>Open file</span>
                                    {ans.fileName && (
                                      <span className="text-muted-foreground font-normal">
                                        ({ans.fileName})
                                      </span>
                                    )}
                                    <ExternalLink className="size-3 shrink-0" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {truncateString(ans.value, 60)}
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                          {answers.length > 3 && (
                            <span className="text-[11px] text-muted-foreground/80 font-medium">
                              +{answers.length - 3} more answer{answers.length - 3 === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Sync status badge */}
                      <TableCell>
                        {row.syncStatus === "synced" && (
                          <Badge
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                          >
                            <CheckCircle2 className="size-3" />
                            Synced
                          </Badge>
                        )}
                        {row.syncStatus === "pending" && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Clock className="size-3 text-amber-500" />
                            Pending
                          </Badge>
                        )}
                        {row.syncStatus === "failed" && (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertCircle className="size-3" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>

                      {/* Sync Error / Details */}
                      <TableCell>
                        {row.syncError ? (
                          <p
                            className="text-xs text-destructive line-clamp-2 wrap-break-word"
                            title={row.syncError}
                          >
                            {row.syncError}
                          </p>
                        ) : row.syncedAt ? (
                          <span className="text-xs text-muted-foreground">
                            Synced {formatResponseDate(row.syncedAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Attempts: {row.syncAttempts}
                          </span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          {row.isRetryable && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isRetrying || isPending}
                              onClick={() => handleRetryRow(row.id)}
                              className="h-8 gap-1.5 text-xs font-medium"
                            >
                              <RefreshCw
                                className={`size-3 ${
                                  isRetrying ? "animate-spin" : ""
                                }`}
                              />
                              {isRetrying ? "Retrying..." : "Retry"}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailSubmission(row)}
                            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="size-3.5" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Stacked Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {submissions.rows.map((row) => {
              const answers = getSubmissionAnswers(row.data, fields);
              const preview = answers.slice(0, 3);
              const isRetrying = retryingRowId === row.id;

              return (
                <Card
                  key={row.id}
                  className="cursor-pointer hover:border-foreground/30 transition-colors"
                  onClick={() => setDetailSubmission(row)}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Top Row: Submitted Date + Sync Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {formatResponseDate(row.createdAt)}
                      </span>
                      {row.syncStatus === "synced" && (
                        <Badge
                          variant="default"
                          className="bg-emerald-600 text-white text-[11px] gap-1 py-0.5"
                        >
                          <CheckCircle2 className="size-3" />
                          Synced
                        </Badge>
                      )}
                      {row.syncStatus === "pending" && (
                        <Badge
                          variant="secondary"
                          className="text-[11px] gap-1 py-0.5"
                        >
                          <Clock className="size-3 text-amber-500" />
                          Pending
                        </Badge>
                      )}
                      {row.syncStatus === "failed" && (
                        <Badge
                          variant="destructive"
                          className="text-[11px] gap-1 py-0.5"
                        >
                          <AlertCircle className="size-3" />
                          Failed
                        </Badge>
                      )}
                    </div>

                    {/* Preview of first 3 answers */}
                    <div className="space-y-1 border-t pt-2.5">
                      {preview.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">
                          No answers recorded
                        </span>
                      ) : (
                        preview.map((ans, idx) => (
                          <div
                            key={idx}
                            className="text-xs leading-snug wrap-break-word"
                          >
                            <span className="font-medium text-foreground">
                              {ans.label}:
                            </span>{" "}
                            {ans.fieldType === "file" && ans.fileUrl ? (
                              <a
                                href={ans.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                              >
                                <span>Open file</span>
                                {ans.fileName && (
                                  <span className="text-muted-foreground font-normal">
                                    ({ans.fileName})
                                  </span>
                                )}
                                <ExternalLink className="size-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">
                                {truncateString(ans.value, 60)}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                      {answers.length > 3 && (
                        <span className="text-[11px] text-muted-foreground font-medium block pt-0.5">
                          +{answers.length - 3} more answer{answers.length - 3 === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

                    {/* Stored Error message if failed */}
                    {row.syncError && (
                      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive wrap-break-word">
                        {row.syncError}
                      </div>
                    )}

                    {/* Bottom Action Row */}
                    <div
                      className="flex items-center justify-end gap-2 border-t pt-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.isRetryable && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isRetrying || isPending}
                          onClick={() => handleRetryRow(row.id)}
                          className="h-8 gap-1.5 text-xs font-medium"
                        >
                          <RefreshCw
                            className={`size-3 ${
                              isRetrying ? "animate-spin" : ""
                            }`}
                          />
                          {isRetrying ? "Retrying..." : "Retry"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setDetailSubmission(row)}
                        className="h-8 gap-1 text-xs"
                      >
                        <Eye className="size-3" />
                        View details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {submissions.pageCount > 1 && (
            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="text-xs text-muted-foreground font-medium">
                Page {submissions.page} of {submissions.pageCount}
              </div>
              <div className="flex items-center gap-2">
                {submissions.page > 1 ? (
                  <Link
                    href={`/admin/forms/${form.id}/submissions?page=${
                      submissions.page - 1
                    }`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "gap-1 h-8 text-xs",
                    })}
                  >
                    <ChevronLeft className="size-3.5" />
                    Previous
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="gap-1 h-8 text-xs"
                  >
                    <ChevronLeft className="size-3.5" />
                    Previous
                  </Button>
                )}

                {submissions.page < submissions.pageCount ? (
                  <Link
                    href={`/admin/forms/${form.id}/submissions?page=${
                      submissions.page + 1
                    }`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "gap-1 h-8 text-xs",
                    })}
                  >
                    Next
                    <ChevronRight className="size-3.5" />
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="gap-1 h-8 text-xs"
                  >
                    Next
                    <ChevronRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Answer Details Dialog */}
      <Dialog
        open={!!detailSubmission}
        onOpenChange={(open) => {
          if (!open) setDetailSubmission(null);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          {detailSubmission && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 pr-6">
                  <DialogTitle className="text-lg">Response Details</DialogTitle>
                  {detailSubmission.syncStatus === "synced" && (
                    <Badge
                      variant="default"
                      className="bg-emerald-600 text-white text-xs gap-1"
                    >
                      <CheckCircle2 className="size-3" />
                      Synced
                    </Badge>
                  )}
                  {detailSubmission.syncStatus === "pending" && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Clock className="size-3 text-amber-500" />
                      Pending
                    </Badge>
                  )}
                  {detailSubmission.syncStatus === "failed" && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <AlertCircle className="size-3" />
                      Failed
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground pt-1">
                  Submitted {formatResponseDate(detailSubmission.createdAt)}
                </DialogDescription>
              </DialogHeader>

              {/* Sync Details Banner if failed */}
              {detailSubmission.syncError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 space-y-1">
                  <span className="text-xs font-semibold text-destructive">
                    Google Sheets sync error:
                  </span>
                  <p className="text-xs text-destructive wrap-break-word">
                    {detailSubmission.syncError}
                  </p>
                </div>
              )}

              {/* Answers List */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Answers ({detailAnswers.length})
                </h4>

                {detailAnswers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No answers recorded for this response.
                  </p>
                ) : (
                  <div className="divide-y rounded-lg border bg-muted/20">
                    {detailAnswers.map((ans, idx) => (
                      <div key={idx} className="p-3.5 space-y-1">
                        <div className="text-xs font-semibold text-foreground">
                          {ans.label}
                        </div>
                        {ans.fieldType === "file" && ans.fileUrl ? (
                          <div className="pt-0.5">
                            <a
                              href={ans.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium text-sm"
                            >
                              <span>Open file</span>
                              {ans.fileName && (
                                <span className="text-muted-foreground font-normal">
                                  ({ans.fileName})
                                </span>
                              )}
                              <ExternalLink className="size-3.5 shrink-0" />
                            </a>
                          </div>
                        ) : (
                          <div className="text-sm text-foreground/90 whitespace-pre-wrap wrap-break-word leading-relaxed">
                            {ans.value}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Retry button in dialog if retryable */}
              {detailSubmission.isRetryable && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      retryingRowId === detailSubmission.id || isPending
                    }
                    onClick={async () => {
                      await handleRetryRow(detailSubmission.id);
                      setDetailSubmission(null);
                    }}
                    className="gap-1.5 text-xs font-medium"
                  >
                    <RefreshCw
                      className={`size-3 ${
                        retryingRowId === detailSubmission.id
                          ? "animate-spin"
                          : ""
                      }`}
                    />
                    {retryingRowId === detailSubmission.id
                      ? "Retrying..."
                      : "Retry sync to Google Sheets"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
