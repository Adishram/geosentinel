import { test, expect, type Page } from "@playwright/test";

async function workspace(page: Page) {
  await page.goto("/#workspace");
  await expect(page.locator(".score-value")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".village-marker")).toHaveCount(6);
  const canvas = await page.locator(".maplibregl-canvas").boundingBox();
  expect(canvas?.height).toBeGreaterThan(400);
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-geography-ready",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Save current baseline" }),
  ).toBeEnabled();
}
function nextCalculation(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/scenario") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
}

test("cinematic landing at 1920px with no application console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Intelligence for the Wild." }),
  ).toBeVisible();
  await expect(page.locator(".hero-geography img")).toBeVisible();
  await expect(page.locator(".hero-actions")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "qa/landing-desktop.png", fullPage: false });
  await page.getByRole("link", { name: "Discover the landscape" }).click();
  await expect(
    page.getByRole("heading", {
      name: "The forest doesn’t end at its boundary.",
    }),
  ).toBeInViewport();
  expect(errors).toEqual([]);
});

test("Python-backed scenario, baseline, missing inputs, and observed mode", async ({
  page,
}) => {
  await workspace(page);
  let response = nextCalculation(page);
  await page.getByRole("button", { name: "Save current baseline" }).click();
  await response;
  await expect(page.locator(".saved-baseline")).toContainText("2026-10-01");
  response = nextCalculation(page);
  await page
    .getByLabel("Hypothetical preset")
    .selectOption("Dry conditions with reduced forest water");
  let result = await (await response).json();
  expect(result.villages[0].score).toBeGreaterThan(
    result.villages[0].baseline_score,
  );
  await expect(page.locator(".score-value > span")).toHaveText(
    result.villages[0].score.toFixed(1),
  );
  await expect(page.locator(".score-delta")).toContainText("+");
  await expect(page.locator(".control-disclosure").first()).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator(".contribution-section")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.getByText("Adjust environmental inputs", { exact: true }).click();
  await expect(
    page.getByLabel("Vegetation stress", { exact: true }),
  ).toBeEnabled();
  response = nextCalculation(page);
  await page
    .locator(".slider-control")
    .filter({ has: page.getByLabel("Vegetation stress", { exact: true }) })
    .getByRole("checkbox", { name: "Unknown", exact: true })
    .check();
  result = await (await response).json();
  expect(result.current.missing_inputs).toContain("vegetation");
  await expect(page.locator(".score-quality")).toContainText(
    "Unknown inputs: vegetation",
  );
  expect(result.villages[0].factors.dryness).not.toBeNull();
  await page.getByText("Input provenance", { exact: true }).click();
  await expect(page.locator(".provenance-section")).toContainText(
    "Missing sub-inputs: vegetation",
  );
  response = nextCalculation(page);
  await page
    .getByRole("button", { name: "Environmental", exact: true })
    .click();
  result = await (await response).json();
  expect(result.current.provenance.rainfall).toContain("observed");
  await expect(
    page.getByLabel("Recent rainfall", { exact: true }),
  ).toBeDisabled();
  response = nextCalculation(page);
  await page
    .getByRole("checkbox", { name: "Override rainfall with a what-if value" })
    .check();
  result = await (await response).json();
  expect(result.current.provenance.rainfall).toBe("hypothetical");
  response = nextCalculation(page);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  result = await (await response).json();
  expect(result.baseline_geofences).toBeNull();
  await expect(page.locator(".score-delta")).toContainText("No baseline saved");
});

test("all six villages, village selection, layers, advisory and analytics", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await workspace(page);
  await page.screenshot({ path: "qa/workspace-overview.png", fullPage: false });
  await page.getByRole("button", { name: "Analyze Thepakkadu" }).hover();
  await expect(page.locator(".village-popover")).toContainText("Thepakkadu");
  await page.getByRole("button", { name: "Analyze Thepakkadu" }).click();
  await expect(page.getByLabel("Analyze village")).toHaveValue("Thepakkadu");
  await page.getByRole("button", { name: "Toggle geographic layers" }).click();
  await page.getByRole("checkbox", { name: "Roads", exact: true }).uncheck();
  await expect(
    page.getByRole("checkbox", { name: "Roads", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Close layers" }).click();
  await page
    .getByRole("button", { name: "Simulated advisory preview" })
    .click();
  await expect(page.locator(".advisory-section pre")).toContainText(
    "SIMULATED ADVISORY — RESEARCH DEMO, NOT REAL",
  );
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-camera-moving",
    "false",
  );
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const panel = document.querySelector(".analysis-content");
    if (panel) panel.scrollTop = 0;
  });
  await page.screenshot({ path: "qa/workspace-laptop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Scenario analytics", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Village scenario scores" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Recharts uses JavaScript animation; screenshot CSS-animation disabling cannot settle it.
  await page.waitForTimeout(1700);
  await page.screenshot({ path: "qa/analytics-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Methodology & sources" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Understanding begins with transparency.",
    }),
  ).toBeVisible();
  await expect(page.locator(".source-register")).toContainText("Pending");
  expect(errors).toEqual([]);
});

test("visual controls do not recalculate; deselect all has clear empty states", async ({
  page,
}) => {
  await workspace(page);
  await expect(page.locator(".map-status")).toHaveCount(0);
  let calculations = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/scenario")) calculations++;
  });
  await page.getByRole("button", { name: "Toggle geographic layers" }).click();
  await page
    .getByRole("checkbox", { name: "Forest", exact: false })
    .first()
    .uncheck()
    .catch(async () => {
      await page.getByRole("checkbox", { name: "OSM forest cover" }).uncheck();
    });
  await page.getByRole("button", { name: "Close layers" }).click();
  await page.locator(".village-disclosure summary").click();
  for (const checkbox of await page.locator(".village-selector input").all())
    await checkbox.uncheck();
  await expect(page.locator(".map-message")).toContainText(
    "No villages selected",
  );
  await expect(page.locator(".analysis-panel")).toContainText(
    "Select a village",
  );
  expect(calculations).toBe(0);
});

test("mobile layout and accessible scenario drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".hero-geography img")).toBeVisible();
  await expect(page.locator(".hero-actions")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "qa/landing-mobile.png", fullPage: false });
  await page
    .getByRole("button", { name: "Explore the Platform" })
    .first()
    .click();
  await expect(page.locator(".score-value")).toBeVisible();
  await expect(page.locator(".controls-panel")).toHaveCount(0);
  await page.locator(".controls-toggle").click();
  await expect(page.locator(".controls-panel")).toBeVisible();
  // Collapsed detail inputs must stay out of the drawer's keyboard focus loop.
  await page.locator(".village-disclosure summary").focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close scenario controls" }),
  ).toBeFocused();
  await page.screenshot({ path: "qa/controls-mobile.png", fullPage: false });
  await page.getByLabel("Scenario date").fill("2026-09-20");
  await page.getByRole("button", { name: "Close scenario controls" }).click();
  await expect(page.locator(".controls-panel")).toHaveCount(0);
  await expect(page.locator(".controls-toggle")).toBeFocused();
  await expect(page.locator(".map-status")).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: "qa/workspace-mobile.png", fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Scenario analytics", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Village scenario scores" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({ path: "qa/analytics-mobile.png", fullPage: true });
});

test("tablet and reduced-motion layouts", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Intelligence for the Wild." }),
  ).toBeVisible();
  await expect(page.locator(".hero-geography img")).toBeVisible();
  await page.screenshot({
    path: "qa/landing-tablet-reduced-motion.png",
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "Explore the Platform" })
    .first()
    .click();
  await expect(page.locator(".score-value")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({ path: "qa/workspace-tablet.png", fullPage: true });
});

test("backend unavailable shows an honest retry state", async ({ page }) => {
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Python API temporarily unavailable" }),
    }),
  );
  await page.goto("/#workspace");
  await expect(page.getByRole("alert")).toContainText(
    "Python API temporarily unavailable",
  );
  await page.unroute("**/api/bootstrap");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".score-value")).toBeVisible();
});
