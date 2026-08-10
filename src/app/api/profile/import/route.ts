import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseCollectionCsv } from "@/lib/csvImport";
import { prisma } from "@/lib/prisma";

/**
 * Import collection CSV for the signed-in user.
 * Body: multipart form field "file", or raw text/csv / application/json { csv: "..." }.
 * Always creates new items (export ids are ignored). Photos are not imported.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let csvText = "";
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: 'Expected multipart field "file".' },
          { status: 400 }
        );
      }
      csvText = await file.text();
    } else if (contentType.includes("application/json")) {
      const body = (await request.json()) as { csv?: string };
      if (typeof body.csv !== "string") {
        return NextResponse.json({ error: 'JSON body must include "csv".' }, { status: 400 });
      }
      csvText = body.csv;
    } else {
      // raw text/csv
      csvText = await request.text();
    }
  } catch {
    return NextResponse.json({ error: "Could not read upload body." }, { status: 400 });
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV is empty." }, { status: 400 });
  }

  const parsed = parseCollectionCsv(csvText);
  if (parsed.items.length === 0 && parsed.errors.length > 0) {
    return NextResponse.json(
      {
        error: "Import failed validation.",
        created: 0,
        failed: parsed.errors.length,
        totalDataRows: parsed.totalDataRows,
        errors: parsed.errors.slice(0, 50),
      },
      { status: 400 }
    );
  }

  let created = 0;
  const createErrors: { row?: number; message: string }[] = [
    ...parsed.errors.map((e) => ({ row: e.row, message: e.message })),
  ];

  for (const item of parsed.items) {
    try {
      await prisma.item.create({
        data: {
          userId: auth.user.id,
          category: item.category.key,
          name: item.name,
          brand: item.brand,
          model: item.model,
          series: item.series,
          finishColor: item.finishColor,
          dateAcquired: item.dateAcquired,
          acquisitionSource: item.acquisitionSource,
          pricePaid: item.pricePaid,
          pricePaidPublic: item.pricePaidPublic,
          serialNumber: item.serialNumber,
          serialNumberPublic: item.serialNumberPublic,
          status: item.status,
          notes: item.notes,
          [item.category.specRelation]: { create: item.specData },
          mods:
            item.mods.length > 0
              ? {
                  create: item.mods.map((m) => ({
                    date: m.date,
                    description: m.description,
                  })),
                }
              : undefined,
        },
      });
      created += 1;
    } catch (err) {
      createErrors.push({
        message:
          err instanceof Error
            ? `Create failed for ${item.brand} ${item.model}: ${err.message}`
            : `Create failed for ${item.brand} ${item.model}.`,
      });
    }
  }

  const failed = createErrors.length;
  const status = created === 0 && failed > 0 ? 400 : 200;

  return NextResponse.json(
    {
      created,
      failed,
      totalDataRows: parsed.totalDataRows,
      errors: createErrors.slice(0, 50),
      message:
        created > 0
          ? `Imported ${created} item${created === 1 ? "" : "s"}${
              failed ? ` (${failed} row error${failed === 1 ? "" : "s"})` : ""
            }.`
          : "No items imported.",
    },
    { status }
  );
}
