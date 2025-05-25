import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const token = jwt.sign({ userId: user.id, tenantId: user.tenantId, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  return NextResponse.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, tenant: user.tenant.name } });
}
