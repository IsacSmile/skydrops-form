import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export const instant = false;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b px-6 py-3 flex items-center justify-between bg-card">
        <span className="font-semibold text-sm">Skydrops Forms · Admin</span>
        <form action={logout}>
          <Button variant="outline" size="sm" type="submit">
            Logout
          </Button>
        </form>
      </header>
      <main className="flex-1 p-6">{children}</main>
      <Toaster position="top-right" />
    </div>
  );
}
