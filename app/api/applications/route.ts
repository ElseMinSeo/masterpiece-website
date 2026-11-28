import { NextResponse } from "next/server";
import { submitForUser } from "@/lib/apply/submit-server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const res = await submitForUser(await createServerSupabase(), createAdminSupabase(), body);
  return NextResponse.json(res.body, { status: res.status });
}
