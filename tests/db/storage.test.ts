import { beforeAll, describe, expect, it } from "vitest";
import { anon, makeUser, type TestUser } from "./helpers";

let a: TestUser;
let b: TestUser;
const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" });

beforeAll(async () => {
  a = await makeUser("st-a");
  b = await makeUser("st-b");
});

describe("프로필 사진 저장소", () => {
  it("본인 폴더에는 올리고 내려받을 수 있다", async () => {
    const up = await a.client.storage.from("profile-photos").upload(`${a.id}/1.png`, png, { contentType: "image/png" });
    expect(up.error).toBeNull();
    const down = await a.client.storage.from("profile-photos").download(`${a.id}/1.png`);
    expect(down.error).toBeNull();
  });

  it("다른 사람 사진은 내려받을 수 없다", async () => {
    const down = await b.client.storage.from("profile-photos").download(`${a.id}/1.png`);
    expect(down.data).toBeNull();
  });

  it("다른 사람 폴더에는 올릴 수 없다", async () => {
    const up = await b.client.storage.from("profile-photos").upload(`${a.id}/x.png`, png, { contentType: "image/png" });
    expect(up.error).not.toBeNull();
  });

  it("로그인하지 않은 방문자는 사진을 볼 수 없다", async () => {
    const down = await anon().storage.from("profile-photos").download(`${a.id}/1.png`);
    expect(down.data).toBeNull();
  });

  it("이미지가 아닌 파일은 올릴 수 없다", async () => {
    const txt = new Blob(["hello"], { type: "text/plain" });
    const up = await a.client.storage.from("profile-photos").upload(`${a.id}/note.txt`, txt, { contentType: "text/plain" });
    expect(up.error).not.toBeNull();
  });
});
