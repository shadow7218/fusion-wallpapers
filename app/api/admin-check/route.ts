import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userIdentifier } = await req.json();
    const adminIdentifier = process.env.ADMIN_UUID || "";

    if (!userIdentifier || !adminIdentifier) {
      return NextResponse.json({ isAdmin: false });
    }

    const isAdmin =
      userIdentifier.trim().toLowerCase() === adminIdentifier.trim().toLowerCase();

    return NextResponse.json({ isAdmin });
  } catch (err: any) {
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}
