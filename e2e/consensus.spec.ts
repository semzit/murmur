import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const EXPECTED_LABEL = "cougar, puma, catamount, mountain lion, painter, panther, Felis concolor";

const openWorker = async (context: BrowserContext): Promise<Page> => {
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText(/registered/)).toBeVisible({ timeout: 30_000 });
  return page;
};

test("three browsers run the real ONNX model locally and reach consensus", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map(openWorker));

  try {
    // Each of our three tabs runs the real ONNX runtime; stale connections
    // from interrupted runs may linger in the workers list, so assert on the
    // onnxruntime-web workers rather than the total count.
    for (const page of pages) {
      await expect(page.getByText("onnxruntime-web")).toHaveCount(3);
    }

    await pages[0]!.getByRole("button", { name: "cat fixture" }).click();
    await pages[0]!.getByRole("button", { name: "Run task" }).click();

    for (const page of pages) {
      await expect(page.getByText(/workers · agreement/)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(EXPECTED_LABEL)).toBeVisible();
    }

    const consensus = pages[0]!.locator("section").filter({ hasText: "Latest consensus" });
    await expect(consensus.getByText(/workers · agreement/)).toContainText("3 workers");
    await expect(consensus.getByText(EXPECTED_LABEL)).toBeVisible();
    await expect(consensus.getByText("safe")).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
