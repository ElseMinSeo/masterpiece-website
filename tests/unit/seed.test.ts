import { describe, expect, it } from "vitest";
import { DEV_PLACES } from "@/lib/data/places";
import { buildSeedSql } from "@/lib/data/seed-sql";

describe("개발용 seed SQL", () => {
  it("개발용 장소 8곳과 파일럿 회차를 모두 넣는다", () => {
    const sql = buildSeedSql(DEV_PLACES);
    for (const p of DEV_PLACES) expect(sql).toContain(`'${p.id}'`);
    expect(sql).toMatch(/insert into public\.cohorts/);
    expect(sql).toContain("'pilot-1'");
  });

  it("작은따옴표가 들어간 값을 안전하게 이스케이프한다", () => {
    const place = { ...DEV_PLACES[0]!, id: "q-1", name: "O'Neil 키친" };
    const sql = buildSeedSql([place]);
    expect(sql).toContain("'O''Neil 키친'");
    expect(sql).not.toContain("'O'Neil");
  });
});
