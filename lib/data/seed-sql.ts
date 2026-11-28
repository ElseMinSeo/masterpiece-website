// 개발용 장소 데이터를 로컬 DB seed SQL로 바꾼다. (npm run db:seed:gen → supabase/seed.sql)
import type { Place } from "@/lib/types";

const q = (v: string | number | boolean | null): string => {
  if (v === null) return "null";
  if (typeof v === "number") return String(Math.trunc(v));
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${v.replaceAll("'", "''")}'`;
};

export function buildSeedSql(places: Place[]): string {
  const rows = places.map((p) =>
    `  (${[p.id, p.name, p.category, p.cuisine, p.district, p.station, p.address, p.priceMinKrw, p.priceMaxKrw,
      p.noise, p.seating, p.hoursText, p.checkedAt, true].map(q).join(", ")})`,
  );
  return [
    "-- 자동 생성 파일: npm run db:seed:gen (원본 lib/data/places.ts). 개발용 가상 데이터.",
    "insert into public.places (id, name, category, cuisine, district, station, address, price_min, price_max,",
    "  noise_level, seating, hours_text, checked_at, published) values",
    rows.join(",\n") + "\non conflict (id) do nothing;",
    "",
    "insert into public.cohorts (code, region, start_at, end_at, status)",
    "values ('pilot-1', '성수 생활권 (개발용)', now(), now() + interval '56 days', 'open')",
    "on conflict (code) do nothing;",
    "",
  ].join("\n");
}
