import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const openWorker = async (context: BrowserContext): Promise<Page> => {
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText(/registered/)).toBeVisible({ timeout: 15_000 });
  return page;
};

test("three browsers run distributed inference and reach consensus", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map(openWorker));

  try {
    for (const page of pages) {
      await expect(page.getByText("Workers (3)")).toBeVisible();
    }

    await pages[0]!.getByRole("button", { name: "Run task" }).click();

    for (const page of pages) {
      await expect(page.getByText(/workers · agreement/)).toBeVisible();
      await expect(page.getByText(/^(safe|unsafe)$/).first()).toBeVisible();
    }

    const consensus = pages[0]!.locator("section").filter({ hasText: "Latest consensus" });
    await expect(consensus.getByText(/workers · agreement/)).toContainText("3 workers");
    await expect(
      consensus
        .locator("div")
        .filter({ hasText: /score \d/ })
        .first(),
    ).toBeVisible();
    const label = await consensus
      .getByText(/^(safe|unsafe)$/)
      .first()
      .textContent();
    expect(["safe", "unsafe"]).toContain(label);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
