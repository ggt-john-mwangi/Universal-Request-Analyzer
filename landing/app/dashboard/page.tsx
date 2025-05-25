import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getUser(token: string) {
  const userRes = await fetch(`/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!userRes.ok) redirect("/");
  const { user } = await userRes.json();
  return user;
}

const rolePriority = [
  { key: "isSuperAdmin", value: "superadmin" },
  { key: "Owner", value: "owner" },
  { key: "Admin", value: "admin" },
  { key: "Member", value: "member" },
  { key: "Viewer", value: "viewer" },
];

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/");

  const user = await getUser(token);

  for (const role of rolePriority) {
    if (role.key === "isSuperAdmin" && user.isSuperAdmin) {
      redirect(`/dashboard/${role.value}`);
    }
    if (user.roles && user.roles.includes(role.key)) {
      redirect(`/dashboard/${role.value}`);
    }
  }
  // Default fallback
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-lg text-red-600">No dashboard available for your role.</div>
    </main>
  );
}
