import { expect, test, type Page } from "@playwright/test";

async function fresh(page: Page) {
  await page.goto("/home");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test("홈 → 장소 저장 → 매칭 신청 → 완료 → 내 약속 (중복 제출 1건)", async ({ page }) => {
  await fresh(page);

  // 장소 조회·저장
  await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "장소" }).click();
  await expect(page.getByTestId("place-card").first()).toBeVisible();
  await page.getByRole("button", { name: "모래정원 키친 저장" }).click();
  await expect(page.getByRole("button", { name: "모래정원 키친 저장 취소" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "모래정원 키친 상세 보기" }).click();
  await expect(page.getByRole("heading", { name: "모래정원 키친", level: 2 })).toBeVisible();
  await expect(page.locator("header").getByRole("button", { name: "모래정원 키친 저장 취소" })).toBeVisible();
  await page.getByRole("link", { name: "프로필" }).click();
  await expect(page.getByTestId("profile-saved-count")).toHaveText("1");
  await page.getByRole("link", { name: "저장", exact: true }).click();
  await expect(page.getByTestId("saved-count")).toContainText("1곳");

  // 매칭 신청 1단계(기본 정보): 빈 상태로 다음 → 필드 오류
  await page.getByRole("link", { name: "홈" }).click();
  await page.getByRole("link", { name: "매칭 시작하기" }).click();
  await expect(page).toHaveURL(/\/apply\/1$/);
  await expect(page.getByRole("list", { name: "4단계 중 1단계" })).toBeVisible();
  await page.getByTestId("step-next").click();
  await expect(page.getByText("닉네임을 입력해주세요.")).toBeVisible();
  await expect(page.getByText("태어난 연도를 선택해주세요.")).toBeVisible();
  await expect(page.getByText("성별을 선택해주세요.")).toBeVisible();
  await page.getByLabel("닉네임").fill("봄바람");
  await page.getByLabel("태어난 연도").selectOption("1996");
  await page.getByRole("radio", { name: "여성" }).click();
  await page.getByLabel("자기소개").fill("주말엔 전시를 보러 다녀요.");
  await page.getByTestId("step-next").click();

  // 2단계(취향) → 새로고침해도 유지
  await expect(page).toHaveURL(/\/apply\/2$/);
  await page.getByRole("button", { name: "독서" }).click();
  await page.getByRole("group", { name: "선호 장소" }).getByRole("button", { name: "카페" }).click();
  await page.getByRole("button", { name: "아늑한" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "독서" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "한식" }).click();
  await page.getByTestId("step-next").click();
  await expect(page.getByText("흡연 여부를 선택해주세요.")).toBeVisible();
  await page.getByRole("radio", { name: "비흡연" }).click();
  await page.getByRole("button", { name: "이전" }).click();
  await expect(page.getByLabel("닉네임")).toHaveValue("봄바람");
  await page.getByTestId("step-next").click();
  await page.getByTestId("step-next").click();

  // 3단계(나): 공백 한 줄 소개 거절
  await expect(page).toHaveURL(/\/apply\/3$/);
  await page.getByLabel("한 줄 소개").fill("   ");
  await page.getByTestId("step-next").click();
  await expect(page.getByText("한 줄 소개를 입력해주세요. 공백만으로는 저장되지 않아요.")).toBeVisible();
  await page.getByRole("button", { name: "다정한" }).click();
  await page.getByRole("checkbox", { name: "적당히" }).click();
  await page.getByLabel("한 줄 소개").fill("조용한 카페에서 천천히 이야기 나누는 걸 좋아해요");
  await page.getByTestId("step-next").click();

  // 4단계(상대)
  await expect(page).toHaveURL(/\/apply\/4$/);
  await page.getByRole("radio", { name: "일정 확인 후 결정" }).click();
  await page.getByTestId("step-next").click();

  // 제출 전 확인: 누락 시 오류
  await expect(page).toHaveURL(/\/apply\/confirm$/);
  await page.getByTestId("step-next").click();
  await expect(page.getByText("가능한 역을 1곳 이상 골라주세요.")).toBeVisible();
  await expect(page.getByText("1인 최소 예산을 입력해주세요.")).toBeVisible();
  await page.getByRole("button", { name: "성수" }).click();
  await page.getByRole("button", { name: "뚝섬" }).click();
  await expect(page.getByRole("button", { name: "왕십리" })).toBeDisabled(); // 최대 2곳
  await page.getByRole("group", { name: "가능한 날짜" }).getByRole("button", { name: /\((월|화|수|목|금)\)/ }).first().click(); // 평일 저녁과 맞는 평일
  await page.getByRole("button", { name: "평일 저녁 (19~21시)" }).click();
  await page.getByLabel("1인 최소 예산(원)").fill("40000");
  await page.getByLabel("1인 최대 예산(원)").fill("20000");
  await page.getByLabel(/위 내용을 확인했고/).check();
  await page.getByTestId("step-next").click();
  await expect(page.getByText("최대 예산은 최소 예산보다 크거나 같아야 해요.")).toBeVisible();
  await page.getByLabel("1인 최대 예산(원)").fill("50000");
  await expect(page.getByTestId("preview-intro")).toContainText("조용한 카페");
  await expect(page.getByTestId("preview-nickname")).toHaveText("봄바람");

  // 연속 클릭: 같은 틱에 세 번 + 더블클릭
  await page.getByTestId("step-next").evaluate((b: HTMLButtonElement) => { b.click(); b.click(); b.click(); });
  await expect(page).toHaveURL(/\/apply\/done/);
  const number = (await page.getByTestId("done-number").textContent())?.trim();
  expect(number).toMatch(/^CG-\d{6}-[0-9A-Z]{4}$/);
  await expect(page.getByText("운영자 검토 대기")).toBeVisible();

  // 제출 후 새로고침해도 같은 신청
  await page.reload();
  await expect(page.getByTestId("done-number")).toHaveText(number!);

  await page.getByRole("link", { name: "내 약속에서 보기" }).click();
  await expect(page.getByTestId("application-card")).toHaveCount(1);
  await expect(page.getByTestId("application-number")).toHaveText(number!);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cheotgil.demo.v1.applications") ?? "[]").length);
  expect(stored).toBe(1);

  // 홈에서도 이어보기, 신청 화면 재진입 시 새 신청 불가
  await page.getByRole("link", { name: "홈" }).click();
  await expect(page.getByTestId("home-app-number")).toHaveText(number!);
  await page.goto("/apply/confirm");
  await expect(page.getByText("이미 접수된 신청이 있어요")).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: /신청 상태 보기/ })).toBeVisible();
});

test("신청 중 다른 탭으로 나갔다 프로필에서 돌아와도 같은 초안", async ({ page }) => {
  await fresh(page);
  await page.goto("/apply");
  await expect(page).toHaveURL(/\/apply\/1$/);
  await page.getByLabel("닉네임").fill("새벽별");
  await page.getByLabel("자기소개").fill("주말엔 전시 보러 다녀요.");
  await page.getByRole("link", { name: "장소" }).click();
  await page.getByRole("link", { name: "프로필" }).click();
  await page.getByRole("link", { name: "작성 중인 신청 이어서 하기" }).click();
  await expect(page).toHaveURL(/\/apply\/1$/);
  await expect(page.getByLabel("닉네임")).toHaveValue("새벽별");
  await expect(page.getByLabel("자기소개")).toHaveValue("주말엔 전시 보러 다녀요.");
  // 단계 건너뛰기 방지
  await page.goto("/apply/4");
  await expect(page).toHaveURL(/\/apply\/1$/);
});

test("필터 결과 없음, 빈 저장 목록, 빈 약속", async ({ page }) => {
  await fresh(page);
  await page.goto("/saved");
  await expect(page.getByText("아직 저장한 장소가 없어요")).toBeVisible();
  await page.goto("/appointments");
  await expect(page.getByText("아직 신청한 내역이 없어요")).toBeVisible();

  await page.goto("/places");
  await page.getByRole("tab", { name: "카페" }).click();
  await page.getByRole("button", { name: "한식" }).click();
  await expect(page.getByText("조건에 맞는 장소가 없어요")).toBeVisible();
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await expect(page.getByTestId("place-card")).toHaveCount(8);

  await page.goto("/places/dev-001");
  await page.getByRole("tab", { name: "메뉴" }).click();
  await expect(page.getByTestId("menu-list").getByRole("listitem")).toHaveCount(3);

  // 홈 바로가기 → 카테고리 필터, 동네별 추천 → 역 필터
  await page.goto("/home");
  await page.getByRole("navigation", { name: "바로가기" }).getByRole("link", { name: "카페" }).click();
  await expect(page.getByTestId("place-card")).toHaveCount(1);
  await page.goto("/home");
  await page.getByRole("link", { name: "서울숲 2곳" }).click();
  await expect(page.getByTestId("place-card")).toHaveCount(2);

  await page.goto("/places");
  await page.getByRole("button", { name: "지역 필터" }).click();
  await page.getByRole("button", { name: "서울숲역" }).click();
  await expect(page.getByTestId("place-card")).toHaveCount(2);
});
