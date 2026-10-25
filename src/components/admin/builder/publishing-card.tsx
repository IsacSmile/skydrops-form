"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Globe,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Archive,
  PowerOff,
  Inbox,
} from "lucide-react";
import type { Form, FormStatus } from "@/types/form";
import { buildShortLink } from "@/lib/short-link";
import { copyToClipboard } from "@/lib/clipboard";
import { setFormStatusAction } from "@/app/admin/(protected)/forms/[id]/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PublishingCardProps {
  form: Form;
  fieldsCount: number;
  origin: string;
  submissionsCount?: number;
}

export function PublishingCard({
  form,
  fieldsCount,
  origin,
  submissionsCount = 0,
}: PublishingCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  // Confirm dialogs
  const [confirmDialog, setConfirmDialog] = useState<"unpublish" | "close" | null>(null);

  const shortLink = buildShortLink(form.slug, origin);
  const hasZeroFields = fieldsCount === 0;

  async function handleCopy() {
    const ok = await copyToClipboard(shortLink);
    if (ok) {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy link");
    }
  }

  function handleTransition(targetStatus: FormStatus, successMessage: string) {
    startTransition(async () => {
      try {
        const res = await setFormStatusAction(form.id, targetStatus);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(successMessage);
          setConfirmDialog(null);
          router.refresh();
        }
      } catch {
        toast.error("An unexpected error occurred. Please try again.");
      }
    });
  }

  const badgeVariant =
    form.status === "published"
      ? "default"
      : form.status === "closed"
        ? "outline"
        : "secondary";

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top row: Status header + Action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Globe className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Publishing
              </span>
              <Badge
                variant={badgeVariant}
                className={`capitalize text-xs font-medium ${
                  form.status === "published"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : form.status === "closed"
                      ? "border-muted-foreground/40 text-muted-foreground"
                      : ""
                }`}
              >
                {form.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {form.status === "published"
                ? "Your form is live and accepting submissions."
                : form.status === "closed"
                  ? "Form is closed to new responses."
                  : "Draft mode — only visible to admins."}
            </p>
          </div>
        </div>

        {/* Action buttons (ONLY allowed actions for the current status) */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {form.status === "draft" && (
            <div className="flex flex-col sm:items-end gap-1">
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  handleTransition("published", "Form published successfully!")
                }
                disabled={isPending || hasZeroFields}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <Globe className="size-3.5 mr-1.5" />
                {isPending ? "Publishing..." : "Publish"}
              </Button>
              {hasZeroFields && (
                <span className="text-xs text-muted-foreground font-normal">
                  Add at least one field before publishing.
                </span>
              )}
            </div>
          )}

          {form.status === "published" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog("close")}
                disabled={isPending}
                className="text-foreground"
              >
                <PowerOff className="size-3.5 mr-1.5 text-muted-foreground" />
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog("unpublish")}
                disabled={isPending}
                className="text-foreground"
              >
                <Archive className="size-3.5 mr-1.5 text-muted-foreground" />
                Unpublish
              </Button>
            </>
          )}

          {form.status === "closed" && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  handleTransition("published", "Form reopened successfully!")
                }
                disabled={isPending || hasZeroFields}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                {isPending ? "Reopening..." : "Reopen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog("unpublish")}
                disabled={isPending}
                className="text-foreground"
              >
                <Archive className="size-3.5 mr-1.5 text-muted-foreground" />
                Unpublish
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Share Box (published or closed) */}
      {(form.status === "published" || form.status === "closed") && (
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              Public short link
            </span>
            {form.status === "closed" && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Currently closed
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Input
                readOnly
                value={shortLink}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="bg-muted/40 font-mono text-xs sm:text-sm pr-9 select-all"
                aria-label="Public short link"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex-1 sm:flex-initial gap-1.5 text-xs"
              >
                {copied ? (
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
              <a
                href={shortLink}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "flex-1 sm:flex-initial gap-1.5 text-xs",
                })}
              >
                Open
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Note for draft forms that were published before */}
      {form.status === "draft" && form.publishedAt !== null && (
        <div className="pt-2 border-t">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            This form was published before, so its structure stays locked.
          </p>
        </div>
      )}

      {/* Responses row */}
      <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Responses: <strong className="text-foreground">{submissionsCount}</strong>
        </span>
        <Link
          href={`/admin/forms/${form.id}/submissions`}
          className="hover:underline font-medium text-foreground inline-flex items-center gap-1.5"
        >
          <Inbox className="size-3.5 text-muted-foreground" />
          Responses ({submissionsCount}) &rarr;
        </Link>
      </div>

      {/* Confirm Unpublish Dialog */}
      <Dialog
        open={confirmDialog === "unpublish"}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
              Unpublish form?
            </DialogTitle>
            <DialogDescription className="text-left text-sm pt-2 text-muted-foreground leading-relaxed">
              The link will stop working immediately. Existing submissions are kept.
              You can&apos;t remove fields later because this form was already published.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDialog(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() =>
                handleTransition("draft", "Form unpublished")
              }
              disabled={isPending}
            >
              {isPending ? "Unpublishing..." : "Unpublish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Close Dialog */}
      <Dialog
        open={confirmDialog === "close"}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <PowerOff className="size-5 text-muted-foreground shrink-0" />
              Close form?
            </DialogTitle>
            <DialogDescription className="text-left text-sm pt-2 text-muted-foreground leading-relaxed">
              People opening the link will see that the form is closed. Existing
              submissions are kept. You can reopen it any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDialog(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() =>
                handleTransition("closed", "Form closed")
              }
              disabled={isPending}
            >
              {isPending ? "Closing..." : "Close form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
