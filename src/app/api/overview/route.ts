import { NextResponse } from "next/server";
import { getWorkspaceSnapshot } from "@/lib/mission-control";

export async function GET() {
  const snapshot = await getWorkspaceSnapshot();
  return NextResponse.json(snapshot);
}
