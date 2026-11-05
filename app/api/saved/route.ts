import { NextResponse } from "next/server";
import { sql } from "@/lib/db-server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json([]);

    const rows = await sql`
      SELECT wallpaper_id FROM saved_wallpapers
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(rows.map((r: any) => r.wallpaper_id));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, wallpaperId } = await req.json();
    await sql`
      INSERT INTO saved_wallpapers (user_id, wallpaper_id)
      VALUES (${userId}, ${wallpaperId})
      ON CONFLICT (user_id, wallpaper_id) DO NOTHING
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId, wallpaperId } = await req.json();
    await sql`
      DELETE FROM saved_wallpapers
      WHERE user_id = ${userId} AND wallpaper_id = ${wallpaperId}
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
