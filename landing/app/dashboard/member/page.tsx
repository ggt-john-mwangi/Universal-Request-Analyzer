import { cookies } from "next/headers";

export default async function MemberDashboard() {
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
  if (!user.roles.includes("Member")) return <div className="text-red-600">Not authorized</div>;

  // Fetch member dashboard data (recent requests, personal stats)
  const dashRes = await fetch(`/api/member`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!dashRes.ok) return <div className="text-red-600">Failed to load dashboard</div>;
  const { requests } = await dashRes.json();

  return (
    <main className="min-h-screen bg-gradient-to-r from-[#1F1A3D] via-[#4A00E0] to-[#00DFD8] p-8">
      <div className="max-w-5xl mx-auto bg-white/90 dark:bg-[#0a0a0a]/90 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold mb-6 text-[#4A00E0]">Member Dashboard</h1>
        <section>
          <h2 className="text-xl font-semibold mb-2">Your Recent Requests</h2>
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
