import { NextResponse } from "next/server";
import { sql } from "@/lib/db-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows = await sql`SELECT * FROM wallpapers WHERE id = ${id} LIMIT 1`;
    return NextResponse.json(rows[0] || null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.tags !== undefined && body.category === undefined) {
      const rows = await sql`
        UPDATE wallpapers
        SET tags = ${body.tags}
        WHERE id = ${id}
        RETURNING *
      `;
      return NextResponse.json(rows[0]);
    }

    if (body.image_url && body.storage_path) {
      const rows = await sql`
        UPDATE wallpapers
        SET image_url = ${body.image_url}, storage_path = ${body.storage_path}
        WHERE id = ${id}
        RETURNING *
      `;
      return NextResponse.json(rows[0]);
    }

    const rows = await sql`
      UPDATE wallpapers
      SET category = ${body.category}, is_banner = ${body.is_banner ?? false}, tags = ${body.tags ?? []}
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await sql`DELETE FROM wallpapers WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
