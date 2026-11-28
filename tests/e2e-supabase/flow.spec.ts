import { expect, test, type Page } from "@playwright/test";

const login = async (page: Page, tag: string) => {
  const res = await page.request.post("/api/dev/login", { data: { email: `${tag}-${Date.now()}@test.local` } });
  expect(res.status()).toBe(200);
};

async function fillApplication(page: Page) {
  await page.goto("/apply");
  await expect(page).toHaveURL(/\/apply\/1$/);
  await page.getByLabel("닉네임").fill("서버초안");
  await page.getByLabel("태어난 연도").selectOption("1996");
  await page.getByRole("radio", { name: "여성" }).click();
  await page.waitForTimeout(900); // 초안 자동 저장(600ms) 대기
  await page.reload();
  await expect(page.getByLabel("닉네임")).toHaveValue("서버초안"); // 서버 초안 복원
  await page.getByTestId("step-next").click();

  await page.getByRole("button", { name: "독서" }).click();
  await page.getByRole("group", { name: "선호 장소" }).getByRole("button", { name: "카페" }).click();
  await page.getByRole("button", { name: "아늑한" }).click();
  await page.getByRole("button", { name: "한식" }).click();
  await page.getByRole("radio", { name: "비흡연" }).click();
  await page.getByTestId("step-next").click();

  await page.getByRole("button", { name: "다정한" }).click();
  await page.getByRole("checkbox", { name: "적당히" }).click();
  await page.getByLabel("한 줄 소개").fill("조용한 곳에서 대화하는 걸 좋아해요");
  await page.getByTestId("step-next").click();
  await page.getByTestId("step-next").click();

  await page.getByRole("button", { name: "성수" }).click();
  await page.getByRole("group", { name: "가능한 날짜" }).getByRole("button").nth(1).click();
  await page.getByRole("button", { name: "평일 저녁 (19~21시)" }).click();
  await page.getByLabel("1인 최소 예산(원)").fill("20000");
  await page.getByLabel("1인 최대 예산(원)").fill("40000");
  await page.getByLabel(/위 내용을 확인했고/).check();
}

test("로그인 사용자별 저장·신청, 다른 사용자에게는 보이지 않음", async ({ page, browser }) => {
  await login(page, "flow-a");

  await page.goto("/places");
  await page.getByRole("button", { name: "모래정원 키친 저장" }).click();
  await expect(page.getByRole("button", { name: "모래정원 키친 저장 취소" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "모래정원 키친 저장 취소" })).toBeVisible(); // 서버에 저장됨

  await fillApplication(page);
  await page.getByTestId("step-next").evaluate((b: HTMLButtonElement) => { b.click(); b.click(); b.click(); });
  await expect(page).toHaveURL(/\/apply\/done/);
  const number = (await page.getByTestId("done-number").textContent())!.trim();
  await expect(page.getByText("운영자 검토 대기")).toBeVisible();

  await page.goto("/appointments");
  await expect(page.getByTestId("application-card")).toHaveCount(1);
  await expect(page.getByTestId("application-number")).toHaveText(number);
  expect(await page.evaluate(() => localStorage.getItem("cheotgil.demo.v1.applications"))).toBeNull();

  const other = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pageB = await other.newPage();
  await login(pageB, "flow-b");
  await pageB.goto("/appointments");
  await expect(pageB.getByText("아직 신청한 내역이 없어요")).toBeVisible();
  await pageB.goto("/saved");
  await expect(pageB.getByText("아직 저장한 장소가 없어요")).toBeVisible();
  await other.close();
});

test("로그인하지 않고 저장을 누르면 로그인 화면으로 간다", async ({ page }) => {
  await page.goto("/places");
  await page.getByRole("button", { name: "모래정원 키친 저장" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fplaces/);
});
