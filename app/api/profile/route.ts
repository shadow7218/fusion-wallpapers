import { NextResponse } from "next/server";
import { sql } from "@/lib/db-server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json(null);

    const rows = await sql`
      SELECT id, display_name FROM profiles WHERE id = ${userId} LIMIT 1
    `;
    return NextResponse.json(rows[0] || null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, displayName } = await req.json();
    const rows = await sql`
      INSERT INTO profiles (id, display_name, updated_at)
      VALUES (${userId}, ${displayName}, NOW())
      ON CONFLICT (id) DO UPDATE
      SET display_name = EXCLUDED.display_name, updated_at = NOW()
      RETURNING id, display_name
    `;
    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
