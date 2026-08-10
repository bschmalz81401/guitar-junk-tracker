import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { itemsToCsv } from "@/lib/csvExport";
import { itemInclude } from "@/lib/items";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const items = await prisma.item.findMany({
    where: { userId: auth.user.id },
    include: itemInclude,
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });

  const csv = itemsToCsv(items);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `guitar-tracker-export-${auth.user.id}-${stamp}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
