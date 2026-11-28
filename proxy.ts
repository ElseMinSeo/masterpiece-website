import { NextResponse, type NextRequest } from "next/server";
import { dataSource } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy-session";

// supabase 모드에서만 로그인 세션을 확인한다. 데모(local-demo) 모드에서는 아무것도 하지 않는다.
export async function proxy(request: NextRequest) {
  if (dataSource() !== "supabase") return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
