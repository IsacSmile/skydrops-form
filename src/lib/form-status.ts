import type { FormStatus } from "@/types/form";

export type StatusActionType = "publish" | "unpublish" | "close" | "reopen";

export interface StatusActionConfig {
  action: StatusActionType;
  label: string;
  targetStatus: FormStatus;
  description?: string;
  needsConfirmation: boolean;
}

/**
 * Valid form status transitions enforced across the application:
 * - draft     -> published (Publish)
 * - published -> draft     (Unpublish)
 * - published -> closed    (Close)
 * - closed    -> published (Reopen)
 * - closed    -> draft     (Unpublish)
 */
export const ALLOWED_TRANSITIONS: Record<FormStatus, readonly FormStatus[]> = {
  draft: ["published"],
  published: ["draft", "closed"],
  closed: ["published", "draft"],
};

/**
 * Checks whether a transition between two statuses is allowed.
 * Same-status transitions return false.
 */
export function canTransition(from: FormStatus, to: FormStatus): boolean {
  if (from === to) return false;
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export const STATUS_LABELS: Record<FormStatus, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
};

/**
 * Returns available user actions for a given form status.
 */
export function getAvailableStatusActions(status: FormStatus): StatusActionConfig[] {
  switch (status) {
    case "draft":
      return [
        {
          action: "publish",
          label: "Publish",
          targetStatus: "published",
          description: "Make this form live and accept submissions",
          needsConfirmation: false,
        },
      ];
    case "published":
      return [
        {
          action: "unpublish",
          label: "Unpublish",
          targetStatus: "draft",
          description:
            "The link will stop working immediately. Existing submissions are kept. You can't remove fields later because this form was already published.",
          needsConfirmation: true,
        },
        {
          action: "close",
          label: "Close",
          targetStatus: "closed",
          description:
            "People opening the link will see that the form is closed. Existing submissions are kept. You can reopen it any time.",
          needsConfirmation: true,
        },
      ];
    case "closed":
      return [
        {
          action: "reopen",
          label: "Reopen",
          targetStatus: "published",
          description: "Start accepting submissions again on the short link",
          needsConfirmation: false,
        },
        {
          action: "unpublish",
          label: "Unpublish",
          targetStatus: "draft",
          description:
            "The link will stop working immediately. Existing submissions are kept. You can't remove fields later because this form was already published.",
          needsConfirmation: true,
        },
      ];
    default:
      return [];
  }
}
