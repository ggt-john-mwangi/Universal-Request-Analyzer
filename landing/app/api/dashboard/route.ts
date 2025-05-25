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
    // Fetch dashboard data for the user's tenant
    const requests = await prisma.request.findMany({
      where: { tenantId: payload.tenantId },
      include: { timings: true, headers: true },
      orderBy: { timestamp: "desc" },
      take: 50,
    });
    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
