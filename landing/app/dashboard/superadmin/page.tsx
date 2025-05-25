import { cookies } from "next/headers";

export default async function SuperAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return <div className="text-red-600">Not authenticated</div>;

  // Fetch user info to check superadmin status
  const res = await fetch(`/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return <div className="text-red-600">Not authorized</div>;
  const { user } = await res.json();
  if (!user.isSuperAdmin) return <div className="text-red-600">Not authorized</div>;

  // Fetch system-wide stats, tenants, users, etc.
  const sysRes = await fetch(`/api/superadmin`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!sysRes.ok) return <div className="text-red-600">Failed to load dashboard</div>;
  const { tenants, users, requests, roles, permissions } = await sysRes.json();

  return (
    <main className="min-h-screen bg-gradient-to-r from-[#1F1A3D] via-[#4A00E0] to-[#00DFD8] p-8">
      <div className="max-w-6xl mx-auto bg-white/90 dark:bg-[#0a0a0a]/90 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold mb-6 text-[#4A00E0]">SuperAdmin Dashboard</h1>
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Tenants</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#4A00E0] text-white">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Users</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant: any) => (
                  <tr key={tenant.id} className="border-b border-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <td className="px-3 py-2">{tenant.id}</td>
                    <td className="px-3 py-2">{tenant.name}</td>
                    <td className="px-3 py-2">{tenant.users.length}</td>
                    <td className="px-3 py-2">{new Date(tenant.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Users</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#4A00E0] text-white">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Roles</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: any) => (
                  <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <td className="px-3 py-2">{user.id}</td>
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">{user.name}</td>
                    <td className="px-3 py-2">{user.tenant?.name}</td>
                    <td className="px-3 py-2">{user.roles.map((r: any) => r.name).join(", ")}</td>
                    <td className="px-3 py-2">{new Date(user.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Requests</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#4A00E0] text-white">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req: any) => (
                  <tr key={req.id} className="border-b border-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <td className="px-3 py-2">{req.id}</td>
                    <td className="px-3 py-2 max-w-xs truncate" title={req.url}>{req.url}</td>
                    <td className="px-3 py-2">{req.tenant?.name}</td>
                    <td className="px-3 py-2">{req.user?.email}</td>
                    <td className="px-3 py-2">{req.status}</td>
                    <td className="px-3 py-2">{new Date(req.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Roles & Permissions</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#4A00E0] text-white">
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Permissions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role: any) => (
                  <tr key={role.id} className="border-b border-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <td className="px-3 py-2">{role.name}</td>
                    <td className="px-3 py-2">{role.permissions.map((p: any) => p.name).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">All Permissions</h2>
          <ul className="list-disc pl-6">
            {permissions.map((p: any) => (
              <li key={p.id}>{p.name} - {p.description}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
