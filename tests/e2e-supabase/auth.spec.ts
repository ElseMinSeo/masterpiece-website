import { expect, test } from "@playwright/test";
import { latestOtp } from "./mail";

const unique = (tag: string) => `${tag}-${Date.now()}@test.local`;

test("로그인하지 않으면 신청 화면 대신 로그인으로 보낸다", async ({ page }) => {
  await page.goto("/apply");
  await expect(page).toHaveURL(/\/login\?next=%2Fapply$/);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("장소 둘러보기는 로그인 없이 된다", async ({ page }) => {
  await page.goto("/places");
  await expect(page.getByTestId("place-card").first()).toBeVisible();
});

test("이메일 코드로 로그인하고 필수 동의 후 원래 가려던 곳으로 간다", async ({ page }) => {
  const email = unique("otp");
  await page.goto("/login?next=%2Fapply");
  await page.getByLabel("이메일").fill("not-an-email");
  await page.getByRole("button", { name: "코드 받기" }).click();
  await expect(page.getByText("이메일 형식이 올바르지 않아요.")).toBeVisible();

  // 휴대폰 자동입력: 이메일 제안, 문자·메일로 받은 코드 제안, 맞춤법 검사 끔
  await expect(page.getByLabel("이메일")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("이메일")).toHaveAttribute("spellcheck", "false");
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "코드 받기" }).click();
  await expect(page.getByLabel("6자리 코드")).toBeVisible();
  await expect(page.getByLabel("6자리 코드")).toHaveAttribute("autocomplete", "one-time-code");
  await expect(page.getByLabel("6자리 코드")).toHaveAttribute("spellcheck", "false");

  await page.getByLabel("6자리 코드").fill("000000");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("코드가 맞지 않거나 만료됐어요. 다시 받아주세요.")).toBeVisible();

  await page.getByLabel("6자리 코드").fill(await latestOtp(email));
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/onboarding\/consent/);
  await page.getByRole("button", { name: "동의하고 시작하기" }).click();
  await expect(page.getByText("필수 항목에 모두 동의해주세요.")).toBeVisible();
  await page.getByLabel(/서비스 이용약관 동의/).check();
  await page.getByLabel(/개인정보 수집·이용 동의/).check();
  await page.getByRole("button", { name: "동의하고 시작하기" }).click();
  await expect(page).toHaveURL(/\/apply\/1$/);
});

test("개발용 테스트 로그인은 동의까지 처리하고 바로 쓸 수 있다", async ({ page }) => {
  const res = await page.request.post("/api/dev/login", { data: { email: unique("dev") } });
  expect(res.status()).toBe(200);
  await page.goto("/appointments");
  await expect(page).toHaveURL(/\/appointments$/);
});

test("개발용 본인확인 흉내: 프로필 배지가 확인 완료로 바뀐다", async ({ page }) => {
  await page.request.post("/api/dev/login", { data: { email: unique("verify") } });
  await page.goto("/profile");
  await expect(page.getByTestId("verification-status")).toHaveText("본인확인 전");
  await page.getByRole("button", { name: "개발용: 확인 완료 처리" }).click();
  await expect(page.getByTestId("verification-status")).toHaveText("확인 완료");
});
