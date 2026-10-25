import Link from "next/link";
import { notFound } from "next/navigation";
import { getForm } from "@/lib/forms-data";
import { Badge } from "@/components/ui/badge";

export const instant = false;

interface FormPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminFormBuilderPlaceholderPage({
  params,
}: FormPageProps) {
  const { id } = await params;
  const form = await getForm(id);

  if (!form) {
    notFound();
  }

  const badgeVariant =
    form.status === "published"
      ? "default"
      : form.status === "closed"
        ? "outline"
        : "secondary";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to forms
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{form.title}</h1>
        <Badge variant={badgeVariant} className="capitalize">
          {form.status}
        </Badge>
      </div>

      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        Form builder arrives in C4
      </div>
    </div>
  );
}
