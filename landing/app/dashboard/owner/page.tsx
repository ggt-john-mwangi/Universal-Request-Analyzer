import { cookies } from "next/headers";

export default async function OwnerDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return <div className="text-red-600">Not authenticated</div>;

  // Fetch user info to check role
  const res = await fetch(`/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return <div className="text-red-600">Not authorized</div>;
  const { user } = await res.json();
  if (!user.roles.includes("Owner")) return <div className="text-red-600">Not authorized</div>;

  // Fetch owner dashboard data (tenant-wide stats, user management, etc.)
  const dashRes = await fetch(`/api/owner`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!dashRes.ok) return <div className="text-red-600">Failed to load dashboard</div>;
  const { tenant, users, requests } = await dashRes.json();

  return (
    <main className="min-h-screen bg-gradient-to-r from-[#1F1A3D] via-[#4A00E0] to-[#00DFD8] p-8">
      <div className="max-w-5xl mx-auto bg-white/90 dark:bg-[#0a0a0a]/90 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold mb-6 text-[#4A00E0]">Owner Dashboard</h1>
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Tenant: {tenant.name}</h2>
          <p>Created: {new Date(tenant.createdAt).toLocaleString()}</p>
          <p>Users: {users.length}</p>
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Users</h2>
          <ul className="list-disc pl-6">
            {users.map((u: any) => (
              <li key={u.id}>{u.email} ({u.roles.map((r: any) => r.name).join(", ")})</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">Recent Requests</h2>
          <ul className="list-disc pl-6">
            {requests.map((r: any) => (
              <li key={r.id}>{r.url} - {r.status} - {new Date(r.timestamp).toLocaleString()}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
