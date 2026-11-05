import { test, expect, type Page } from "@playwright/test";

const branches = [
  { priority: "Everything comes back to me.", question: "What pulls you back into the day-to-day?",
    answers: [
      { choice: "People need my approval.", result: "Start with decision ownership." },
      { choice: "I'm the one with the answers.", result: "Make one answer easier to find." },
    ] },
  { priority: "More work. More friction.", question: "Where does the extra work show up?",
    answers: [
      { choice: "We keep doing the same work twice.", result: "Trace the duplicate work." },
      { choice: "Work gets stuck between people.", result: "Look at the gap between tasks." },
    ] },
  { priority: "I can't get a clear picture.", question: "What's hardest to see clearly?",
    answers: [
      { choice: "Where we're making or losing money.", result: "Follow the effort behind one sale." },
      { choice: "What's happening right now.", result: "Agree what an honest status looks like." },
    ] },
];

async function checkDock(page: Page): Promise<void> {
  const link = page.getByTestId("call-bar-schedule");
  await expect(link).toBeInViewport({ ratio: 1 });
  await expect(link).toHaveAttribute("href",
    "https://scheduler.zoom.us/collin-thomas/30-minute-meeting-with-collin-from-rinsesoft");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  const dock = await page.getByTestId("call-bar-dock").boundingBox();
  const button = await link.boundingBox();
  expect(dock).not.toBeNull();
  expect(button).not.toBeNull();
  expect(button!.y).toBeGreaterThanOrEqual(dock!.y);
  expect(button!.y + button!.height).toBeLessThanOrEqual(dock!.y + dock!.height);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  for (const branch of branches) {
    for (const answer of branch.answers) {
      test(`business check: ${answer.result} at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const errors: string[] = [];
        const requests: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/business-check");
        await page.evaluate(() => document.fonts.ready);
        page.on("request", (request) => {
          if (request.method() !== "GET" || ["fetch", "xhr"].includes(request.resourceType())) {
            requests.push(request.url());
          }
        });
        await expect(page.getByTestId("business-check-progress")).toContainText("Question 1 of 2");
        await expect(page.getByTestId("business-check-next")).toHaveCount(0);
        await expect(page.getByTestId("business-check-experiment")).toHaveCount(0);
        await expect(page.getByTestId("business-check-instruction")).toContainText("Selecting an answer takes you straight");
        await expect(page.getByTestId("business-check-back")).toBeHidden();
        await checkDock(page);
        await page.getByTestId("check-choice").filter({ hasText: branch.priority }).click();
        await expect(page.getByTestId("business-check-question").filter({ hasText: branch.question })).toBeFocused();
        await expect(page.getByTestId("business-check-progress")).toContainText("Question 2 of 2");
        await expect(page.getByRole("radio")).toHaveCount(2);
        await checkDock(page);
        await page.getByTestId("check-choice").filter({ hasText: answer.choice }).click();
        await expect(page.getByRole("heading", { name: answer.result, exact: true })).toBeVisible();
        await expect(page.getByRole("article")).toHaveCount(1);
        await expect(page.getByRole("article")).toBeFocused();
        await expect(page.getByRole("article")).toContainText("One thing to try");
        await expect(page.getByTestId("business-check-next")).toBeHidden();
        await expect(page.getByRole("radio")).toHaveCount(0);
        const booking = page.getByTestId("check-result-schedule").filter({ visible: true });
        await expect(booking).toHaveText("Continue this discussion with us ↗");
        await expect(booking).toHaveAttribute("href",
          await page.getByTestId("call-bar-schedule").getAttribute("href") ?? "");
        await expect(booking).toHaveAttribute("target", "_blank");
        await expect(booking).toHaveAttribute("rel", "noopener noreferrer");
        await booking.scrollIntoViewIfNeeded();
        await expect.poll(async () => {
          const button = await booking.boundingBox();
          const dock = await page.getByTestId("call-bar-dock").boundingBox();
          return button!.y + button!.height <= dock!.y;
        }).toBe(true);
        await checkDock(page);
        await page.getByTestId("site-footer").scrollIntoViewIfNeeded();
        await checkDock(page);
        const footer = await page.getByTestId("site-footer").boundingBox();
        const bottomDock = await page.getByTestId("call-bar-dock").boundingBox();
        expect(footer!.y + footer!.height).toBeLessThanOrEqual(bottomDock!.y);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
        expect(requests).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  }
}

test("back, changed answers, restart, and page restoration keep the right branch", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("home-hero-business-check").click();
  await expect(page).toHaveURL(/\/business-check$/);
  await page.getByRole("radio", { name: /Everything comes back/ }).check();
  await page.getByRole("radio", { name: /People need my approval/ }).check();
  await page.getByTestId("business-check-back").click();
  await expect(page.getByRole("radio", { name: /People need my approval/ })).not.toBeChecked();
  await page.getByRole("radio", { name: /I'm the one with the answers/ }).check();
  await expect(page.getByRole("heading", { name: "Make one answer easier to find." })).toBeVisible();
  await page.getByTestId("business-check-back").click();
  await page.getByTestId("business-check-back").click();
  await page.getByRole("radio", { name: /More work. More friction/ }).check();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await page.getByRole("radio", { name: /Work gets stuck/ }).check();
  await expect(page.getByRole("heading", { name: "Look at the gap between tasks." })).toBeVisible();
  await page.getByTestId("business-check-restart").click();
  await expect(page.getByTestId("business-check-progress")).toContainText("Question 1 of 2");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByTestId("business-check-next")).toHaveCount(0);
  await page.getByTestId("business-check-guide").click();
  await expect(page.getByTestId("bottleneck-checklist")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("business-check-progress")).toContainText("Question 1 of 2");
  await expect(page.getByTestId("business-check-next")).toHaveCount(0);
});

test("the business check can be completed using only the keyboard", async ({ page }) => {
  await page.goto("/business-check");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("main-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: /Everything comes back/ })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("business-check-question").filter({ hasText: "What pulls you back" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: /People need my approval/ })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("article")).toBeFocused();
  await expect(page.getByRole("heading", { name: "Make one answer easier to find." })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("check-result-schedule").filter({ visible: true })).toBeFocused();
});

test("one-click flow supports back, reselection, changed paths, and restart", async ({ page }) => {
  await page.goto("/business-check");
  await page.getByTestId("check-choice").filter({ hasText: "Everything comes back to me." }).click();
  await page.getByTestId("check-choice").filter({ hasText: "People need my approval." }).click();
  await expect(page.getByRole("heading", { name: "Start with decision ownership." })).toBeVisible();
  await page.getByTestId("business-check-back").click();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await page.getByTestId("check-choice").filter({ hasText: "People need my approval." }).click();
  await expect(page.getByRole("heading", { name: "Start with decision ownership." })).toBeVisible();
  await page.getByTestId("business-check-back").click();
  await page.getByTestId("business-check-back").click();
  await page.getByTestId("check-choice").filter({ hasText: "More work. More friction." }).click();
  await page.getByTestId("check-choice").filter({ hasText: "Work gets stuck between people." }).click();
  await expect(page.getByRole("heading", { name: "Look at the gap between tasks." })).toBeVisible();
  await page.getByTestId("business-check-restart").click();
  await expect(page.getByTestId("business-check-progress")).toContainText("Question 1 of 2");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByTestId("business-check-next")).toBeHidden();
  await expect(page).toHaveURL(/\/business-check$/);
  await expect(page.getByTestId("business-check-experiment")).toHaveCount(0);
});

test("old experiment links retain one-click navigation", async ({ page }) => {
  await page.goto("/business-check?flow=auto");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("main-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("business-check-question").filter({ hasText: "What pulls you back" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("article")).toBeFocused();
  await expect(page.getByRole("heading", { name: "Make one answer easier to find." })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("check-result-schedule").filter({ visible: true })).toBeFocused();
});

test("without JavaScript, starting points and persistent scheduling are still available", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8081/business-check");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByTestId("business-check-next")).toBeHidden();
  await expect(page.getByRole("article")).toHaveCount(6);
  await checkDock(page);
  await page.getByTestId("site-footer").scrollIntoViewIfNeeded();
  await checkDock(page);
  await page.getByTestId("business-check-guide").click();
  await expect(page.getByTestId("bottleneck-checklist")).toBeVisible();
  await context.close();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`scheduling does not block the flow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/business-check");
    await checkDock(page);
    await page.getByRole("radio", { name: /Everything comes back/ }).check();
    await checkDock(page);
    await page.getByRole("radio", { name: /People need my approval/ }).check();
    await expect(page.getByRole("heading", { name: "Start with decision ownership." })).toBeVisible();
    await page.getByTestId("business-check-back").click();
    await expect(page.getByRole("radio", { name: /People need my approval/ })).not.toBeChecked();
    await checkDock(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
