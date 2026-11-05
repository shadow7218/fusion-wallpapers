import { NextResponse } from "next/server";
import { sql } from "@/lib/db-server";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, title, image_url, storage_path, category, is_banner, tags, downloads, created_at
      FROM wallpapers
      ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, image_url, storage_path, category, is_banner, tags } = body;

    const rows = await sql`
      INSERT INTO wallpapers (title, image_url, storage_path, category, is_banner, tags)
      VALUES (${title}, ${image_url}, ${storage_path}, ${category}, ${is_banner ?? false}, ${tags ?? []})
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
