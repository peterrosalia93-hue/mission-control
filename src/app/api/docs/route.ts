import { NextResponse } from "next/server";
import { getDocs } from "@/lib/mission-control";

export async function GET() {
  const docs = await getDocs();
  return NextResponse.json({ docs });
}
