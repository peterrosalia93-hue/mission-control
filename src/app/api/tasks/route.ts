import { NextResponse } from "next/server";
import { getTaskBoard } from "@/lib/mission-control";

export async function GET() {
  const taskBoard = await getTaskBoard();
  return NextResponse.json(taskBoard);
}
