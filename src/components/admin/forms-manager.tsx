"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreVertical,
  Plus,
  Pencil,
  Copy,
  Trash2,
  ExternalLink,
  FileText,
  AlertTriangle,
  Link2,
} from "lucide-react";
import type { FormListItem } from "@/lib/forms-data";
import { buildShortLink } from "@/lib/short-link";
import { copyToClipboard } from "@/lib/clipboard";
import {
  createFormAction,
  updateFormAction,
  duplicateFormAction,
  deleteFormAction,
  type ActionResponse,
} from "@/app/admin/(protected)/forms/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function FormsManager({
  forms,
  origin,
}: {
  forms: FormListItem[];
  origin?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Create form dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createErrors, setCreateErrors] = useState<ActionResponse["fieldErrors"]>();

  // Rename form dialog state
  const [renameTarget, setRenameTarget] = useState<FormListItem | null>(null);
  const [renameErrors, setRenameErrors] = useState<ActionResponse["fieldErrors"]>();

  // Delete form dialog state
  const [deleteTarget, setDeleteTarget] = useState<FormListItem | null>(null);

  async function handleCopyLink(slug: string) {
    const url = buildShortLink(slug, origin);
    const ok = await copyToClipboard(url);
    if (ok) {
      toast.success("Short link copied to clipboard");
    } else {
      toast.error("Failed to copy link");
    }
  }

  // Handle form creation
  async function handleCreate(formData: FormData) {
    setCreateErrors(undefined);
    startTransition(async () => {
      try {
        const res = await createFormAction(undefined, formData);
        if (res?.error) {
          if (res.fieldErrors) {
            setCreateErrors(res.fieldErrors);
          } else {
            toast.error(res.error);
          }
        } else {
          toast.success("Form created successfully!");
          setCreateOpen(false);
        }
      } catch (err: unknown) {
        const digest = (err as { digest?: string })?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        toast.error("Failed to create form. Please try again.");
      }
    });
  }

  // Handle form rename
  async function handleRename(formData: FormData) {
    if (!renameTarget) return;
    setRenameErrors(undefined);

    startTransition(async () => {
      try {
        const res = await updateFormAction(renameTarget.id, undefined, formData);
        if (res?.error) {
          if (res.fieldErrors) {
            setRenameErrors(res.fieldErrors);
          } else {
            toast.error(res.error);
          }
        } else {
          toast.success("Form renamed successfully!");
          setRenameTarget(null);
        }
      } catch {
        toast.error("Failed to rename form.");
      }
    });
  }

  // Handle form duplication
  function handleDuplicate(id: string) {
    startTransition(async () => {
      try {
        const res = await duplicateFormAction(id);
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success("Form duplicated as draft!");
        }
      } catch {
        toast.error("Failed to duplicate form.");
      }
    });
  }

  // Handle form deletion
  function handleDelete() {
    if (!deleteTarget) return;

    startTransition(async () => {
      try {
        const res = await deleteFormAction(deleteTarget.id);
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success("Form permanently deleted.");
          setDeleteTarget(null);
        }
      } catch {
        toast.error("Failed to delete form.");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forms</h1>
          <p className="text-sm text-muted-foreground">
            Create, manage and publish your brand forms
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="size-4" />
          New form
        </Button>
      </div>

      {/* Content */}
      {forms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="p-3 bg-muted rounded-full">
              <FileText className="size-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">No forms created yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Get started by creating your first form to collect submissions and sync to Google Sheets.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="size-4" />
              Create your first form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Fields</TableHead>
                  <TableHead className="text-center">Submissions</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>
                      <Link
                        href={`/admin/forms/${form.id}`}
                        className="font-medium hover:underline text-foreground block"
                      >
                        {form.title}
                      </Link>
                      {form.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-md">
                          {form.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          form.status === "published"
                            ? "default"
                            : form.status === "closed"
                              ? "outline"
                              : "secondary"
                        }
                        className={
                          form.status === "published"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : ""
                        }
                      >
                        {form.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {form.fieldCount}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {form.submissionCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(form.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                            className: "size-8",
                          })}
                        >
                          <MoreVertical className="size-4" />
                          <span className="sr-only">Open actions</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/forms/${form.id}`)}
                            className="gap-2 cursor-pointer"
                          >
                            <ExternalLink className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          {form.status === "published" && (
                            <DropdownMenuItem
                              onClick={() => handleCopyLink(form.slug)}
                              className="gap-2 cursor-pointer"
                            >
                              <Link2 className="size-4" />
                              Copy link
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameTarget(form);
                              setRenameErrors(undefined);
                            }}
                            className="gap-2 cursor-pointer"
                          >
                            <Pencil className="size-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(form.id)}
                            disabled={isPending}
                            className="gap-2 cursor-pointer"
                          >
                            <Copy className="size-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(form)}
                            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {forms.map((form) => (
              <Card key={form.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <Link
                        href={`/admin/forms/${form.id}`}
                        className="font-medium hover:underline text-foreground block text-base"
                      >
                        {form.title}
                      </Link>
                      {form.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {form.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        form.status === "published"
                          ? "default"
                          : form.status === "closed"
                            ? "outline"
                            : "secondary"
                      }
                      className={
                        form.status === "published"
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : ""
                      }
                    >
                      {form.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                    <div className="flex gap-4">
                      <span>{form.fieldCount} fields</span>
                      <span>{form.submissionCount} submissions</span>
                    </div>
                    <span>{formatDate(form.updatedAt)}</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t pt-3">
                    <Link
                      href={`/admin/forms/${form.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Edit
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon",
                          className: "size-8",
                        })}
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {form.status === "published" && (
                          <DropdownMenuItem
                            onClick={() => handleCopyLink(form.slug)}
                            className="gap-2 cursor-pointer"
                          >
                            <Link2 className="size-4" />
                            Copy link
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameTarget(form);
                            setRenameErrors(undefined);
                          }}
                          className="gap-2 cursor-pointer"
                        >
                          <Pencil className="size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(form.id)}
                          disabled={isPending}
                          className="gap-2 cursor-pointer"
                        >
                          <Copy className="size-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(form)}
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create Form Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form action={handleCreate}>
            <DialogHeader>
              <DialogTitle>New form</DialogTitle>
              <DialogDescription>
                Give your form a title and an optional description to get started.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-title">Title *</Label>
                <Input
                  id="create-title"
                  name="title"
                  placeholder="e.g. Customer Feedback Survey"
                  required
                  maxLength={120}
                  disabled={isPending}
                  aria-invalid={!!createErrors?.title}
                />
                {createErrors?.title && (
                  <p className="text-xs text-destructive">
                    {createErrors.title.join(", ")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-description">Description (optional)</Label>
                <Textarea
                  id="create-description"
                  name="description"
                  placeholder="Short description or instructions for your respondents"
                  maxLength={500}
                  disabled={isPending}
                  rows={3}
                  aria-invalid={!!createErrors?.description}
                />
                {createErrors?.description && (
                  <p className="text-xs text-destructive">
                    {createErrors.description.join(", ")}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create form"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Form Dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            setRenameErrors(undefined);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {renameTarget && (
            <form action={handleRename}>
              <DialogHeader>
                <DialogTitle>Rename form</DialogTitle>
                <DialogDescription>
                  Update the title or description for &ldquo;{renameTarget.title}&rdquo;.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="rename-title">Title *</Label>
                  <Input
                    id="rename-title"
                    name="title"
                    defaultValue={renameTarget.title}
                    required
                    maxLength={120}
                    disabled={isPending}
                    aria-invalid={!!renameErrors?.title}
                  />
                  {renameErrors?.title && (
                    <p className="text-xs text-destructive">
                      {renameErrors.title.join(", ")}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rename-description">Description (optional)</Label>
                  <Textarea
                    id="rename-description"
                    name="description"
                    defaultValue={renameTarget.description ?? ""}
                    maxLength={500}
                    disabled={isPending}
                    rows={3}
                    aria-invalid={!!renameErrors?.description}
                  />
                  {renameErrors?.description && (
                    <p className="text-xs text-destructive">
                      {renameErrors.description.join(", ")}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRenameTarget(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {deleteTarget && (
            <div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="size-5" />
                  Delete form &ldquo;{deleteTarget.title}&rdquo;?
                </DialogTitle>
                <div className="space-y-2 pt-2 text-left text-sm text-muted-foreground">
                  <p>
                    This form currently has{" "}
                    <strong className="text-foreground">
                      {deleteTarget.submissionCount} submission{deleteTarget.submissionCount === 1 ? "" : "s"}
                    </strong>.
                  </p>
                  <p className="text-foreground font-medium">
                    This permanently deletes the form and all its submissions from the database. Rows already in Google Sheets are not removed.
                  </p>
                  {deleteTarget.status === "published" && (
                    <p className="text-destructive font-semibold text-xs border border-destructive/20 bg-destructive/10 p-2 rounded">
                      ⚠️ Warning: This form is currently published. Deleting it will cause the public short link to stop working immediately.
                    </p>
                  )}
                </div>
              </DialogHeader>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {isPending ? "Deleting..." : "Permanently delete"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
