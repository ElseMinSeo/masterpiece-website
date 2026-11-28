import { NextResponse } from "next/server";
import { submitForUser } from "@/lib/apply/submit-server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const res = await submitForUser(await createServerSupabase(), body);
  return NextResponse.json(res.body, { status: res.status });
}
