import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = auth.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Return all tenants, users, requests, roles, permissions
    const tenants = await prisma.tenant.findMany({
      include: { users: true },
      orderBy: { createdAt: "desc" },
    });
    const users = await prisma.user.findMany({
      include: { tenant: true, roles: true },
      orderBy: { createdAt: "desc" },
    });
    const requests = await prisma.request.findMany({
      include: { tenant: true, user: true },
      orderBy: { timestamp: "desc" },
      take: 100,
    });
    const roles = await prisma.role.findMany({
      include: { permissions: true },
    });
    const permissions = await prisma.permission.findMany();
    return NextResponse.json({ tenants, users, requests, roles, permissions });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
