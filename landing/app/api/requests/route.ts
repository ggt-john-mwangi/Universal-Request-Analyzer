import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const requests = await prisma.request.findMany({
    include: { timings: true, headers: true },
    orderBy: { timestamp: "desc" },
    take: 20,
  });
  return NextResponse.json(requests);
}
