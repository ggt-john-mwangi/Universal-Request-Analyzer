import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const { email, password, name, tenantName } = await req.json();
  if (!email || !password || !tenantName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }
  let tenant = await prisma.tenant.findFirst({ where: { name: tenantName } });
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { name: tenantName } });
  }
  // Find or create roles
  let ownerRole = await prisma.role.findFirst({ where: { name: "Owner", tenantId: tenant.id } });
  if (!ownerRole) {
    ownerRole = await prisma.role.create({ data: { name: "Owner", tenantId: tenant.id } });
  }
  let memberRole = await prisma.role.findFirst({ where: { name: "Member", tenantId: tenant.id } });
  if (!memberRole) {
    memberRole = await prisma.role.create({ data: { name: "Member", tenantId: tenant.id } });
  }
  // Count users in tenant
  const userCount = await prisma.user.count({ where: { tenantId: tenant.id } });
  // If first user, make Owner (and SuperAdmin if system tenant)
  let roles = [memberRole];
  let isSuperAdmin = false;
  if (userCount === 0) {
    roles = [ownerRole];
    if (tenant.name.toLowerCase() === "system") {
      isSuperAdmin = true;
    }
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      tenantId: tenant.id,
      roles: { connect: roles.map(r => ({ id: r.id })) },
      isSuperAdmin,
    },
  });
  return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, roles: roles.map(r => r.name), isSuperAdmin } });
}
