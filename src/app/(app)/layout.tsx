import { AppShell } from "@/components/app-shell";
import { getUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  return <AppShell userEmail={user?.email}>{children}</AppShell>;
}
