import { expect, test } from "@playwright/test";
import { initialSave, SPECIES, type Save } from "../../src/lib/game";

async function seed(page: import("@playwright/test").Page, save: Save) {
  await page.addInitScript(
    (value) => localStorage.setItem("buscabolets-v1", JSON.stringify(value)),
    save,
  );
  await page.goto("/");
}
for (const tool of ["Marca", "Rasclet del bosc"]) {
  test(`compass reveals its hint while ${tool} is selected`, async ({
    page,
  }) => {
    const save = initialSave();
    save.run.abilities.compass = 2;
    save.run.compassLeft = 2;
    await seed(page, save);
    await page.getByRole("button", { name: new RegExp(tool) }).click();
    const compass = page.getByRole("button", { name: /Olfacte boletaire/ });
    await compass.click();
    await expect(page.getByRole("status")).toContainText("Des de E5");
    await expect(page.getByRole("status")).toBeInViewport({ ratio: 1 });
    await expect(compass).toContainText("1/2");
    await expect(page.getByRole("meter")).toHaveAttribute(
      "aria-valuenow",
      String(save.run.turns),
    );
    await compass.click();
    await expect(compass).toContainText("1/2");
  });
}
test("Catalan game, tools, persistence, and accessible dialogs", async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ca");
  await expect(
    page.getByRole("heading", { name: /Un pas\. Una pista\./ }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Benvingut a Buscabolets" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cap al bosc" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "La teva excursió", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".tile")).toHaveCount(100);
  if (isMobile) {
    await expect(page.locator(".tile").last()).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("button", { name: "Marca", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    for (const name of [/Rasclet del bosc/, /Olfacte boletaire/]) {
      const action = page.getByRole("button", { name });
      await expect(action).toBeInViewport({ ratio: 1 });
      const bounds = await action.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.getByRole("button", { name: "Marca", exact: true }).click();
  await page
    .getByRole("button", { name: "A1, per explorar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "A1, marcada", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("meter")).toHaveAttribute(
    "aria-valuenow",
    String(initialSave().run.budget),
  );
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "A1, marcada", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Com s’hi juga" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cap al bosc" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Olfacte boletaire" }).click();
  await expect(page.getByRole("status")).toContainText("Des de E5");
  await expect(page.getByRole("meter")).toHaveAttribute(
    "aria-valuenow",
    String(initialSave().run.budget),
  );
  await page.getByRole("tab", { name: "El meu quadern", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Les estadístiques no donen avantatges",
  );
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("whole level to reward, upgrade, next level, and restart", async ({
  page,
}) => {
  const save = initialSave(137);
  await seed(page, save);
  for (const mushroom of save.run.mushrooms)
    for (const tile of mushroom.tiles) {
      for (let i = 0; i < SPECIES[mushroom.species].strength; i++)
        await page.locator(".tile").nth(tile).click();
    }
  await expect(page.getByRole("dialog")).toContainText(
    "El bosc et fa un regal.",
  );
  await expect(page.locator(".reward-list>button")).toHaveCount(3);
  await page.locator(".reward-list>button").first().click();
  await expect(page.locator(".level-label .eyebrow")).toHaveText("NIVELL 2");
  await expect(page.locator(".basket-total>strong")).toHaveText("8");
  await page
    .getByRole("button", { name: "Nova excursió", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Tornem a començar?");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Nova excursió" })
    .click();
  await expect(page.locator(".level-label .eyebrow")).toHaveText("NIVELL 1");
  await expect(page.locator(".basket-total>strong")).toHaveText("0");
});
test("loss shows mushroom breakdown, stats, remaining mushrooms, and can restart", async ({
  page,
}) => {
  const save = initialSave(137);
  save.run.turns = 1;
  const cep = save.run.mushrooms.find((m) => m.species === "cep")?.tiles[0];
  expect(cep).toBeDefined();
  if (cep === undefined) return;
  await seed(page, save);
  await page.locator(".tile").nth(cep).click();
  await expect(page.getByRole("dialog")).toContainText(
    "El bosc t’espera un altre dia.",
  );
  await expect(page.locator(".result-species")).toContainText("rovellons");
  await expect(page.locator(".result-species")).toContainText("ceps");
  await expect(page.locator(".result-species")).toContainText("rossinyols");
  await page.getByRole("button", { name: "Repassa el tauler" }).click();
  await expect(page.locator(".tile.missed").first()).toBeVisible();
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
  await page
    .getByRole("button", { name: "Nova excursió", exact: true })
    .click();
  await expect(page.getByRole("meter")).toHaveAttribute(
    "aria-valuenow",
    String(initialSave().run.budget),
  );
});
test("production PWA installs its cache and reloads offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Cap al bosc" }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const manifest = await page.request.get("/manifest.webmanifest");
  expect((await manifest.json()).lang).toBe("ca");
  await page.getByRole("button", { name: "Marca", exact: true }).click();
  await page.locator(".tile").first().click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".tile")).toHaveCount(100);
  await expect(
    page.getByRole("button", { name: "A1, marcada", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "El boletari", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Coneix els teus tresors.",
  );
});

test("rossinyol pair contributes two to the middle clues in the reported layout", async ({
  page,
}) => {
  const save = initialSave();
  save.run.mushrooms = [
    { species: "rossinyol", tiles: [44, 45], damage: [0, 0] },
    { species: "rovello", tiles: [99], damage: [0] },
  ];
  save.run.revealed = [33, 34, 35, 36, 43, 46, 53, 54, 55, 56];
  await seed(page, save);
  for (const index of [34, 35, 54, 55]) {
    await expect(page.locator(".tile").nth(index)).toHaveText("2");
  }
  await expect(page.locator(".tile").nth(33)).toHaveText("1");
  await page.locator(".tile").nth(44).click();
  await page.locator(".tile").nth(45).click();
  for (const index of [34, 35, 54, 55]) {
    await expect(page.locator(".tile").nth(index)).toHaveText("2");
  }
  await expect(page.locator(".basket-total>strong")).toHaveText("1");
});

for (const power of [1, 2, 3]) {
  test(`cep shows exact taps left at picking power ${power}`, async ({
    page,
  }, testInfo) => {
    const save = initialSave();
    save.run.abilities.power = power;
    save.run.mushrooms = [
      { species: "cep", tiles: [44], damage: [0] },
      { species: "rovello", tiles: [99], damage: [0] },
    ];
    await seed(page, save);
    const cep = page.locator(".tile").nth(44);
    await expect(page.locator(".picking-legend")).toHaveCount(0);
    await cep.click();
    const remaining = Math.ceil((3 - power) / power);
    for (let taps = remaining; taps > 0; taps--) {
      await expect(cep).toHaveClass(/needs-picking/);
      await expect(cep.locator(".picking-badge")).toHaveText(`×${taps}`);
      await expect(cep).toHaveAccessibleName(new RegExp(`encara ${taps} toc`));
      await expect(page.getByRole("status")).toContainText(
        `encara ${taps} toc`,
      );
      await expect(page.locator(".picking-legend")).toContainText(
        "Cada toc costa 1 torn",
      );
      await page
        .locator(".board-stage")
        .screenshot({ path: testInfo.outputPath(`remaining-${taps}.png`) });
      await cep.click();
    }
    await expect(cep.locator(".picking-badge")).toHaveCount(0);
    await expect(page.locator(".picking-legend")).toHaveCount(0);
    await expect(cep).toHaveAccessibleName("E5, Cep, collit");
    await expect(cep.locator(".collected-check")).toBeVisible();
    await expect(page.locator(".basket-total>strong")).toHaveText("1");
    await expect(page.getByRole("meter")).toHaveAttribute(
      "aria-valuenow",
      String(save.run.budget - Math.ceil(3 / power)),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
]) {
  test(`board and controls fit the ${viewport.width}×${viewport.height} viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const save = initialSave();
    save.run.mushrooms = [
      { species: "cep", tiles: [44], damage: [0] },
      { species: "rovello", tiles: [99], damage: [0] },
    ];
    await seed(page, save);
    await page.locator(".tile").nth(44).click();
    await expect(page.locator(".picking-legend")).toBeVisible();
    for (const locator of [
      page.locator(".board-grid"),
      page.getByRole("button", { name: "Marca", exact: true }),
      page.getByRole("button", { name: /Rasclet del bosc/ }),
      page.getByRole("button", { name: /Olfacte boletaire/ }),
      page.getByRole("status"),
      page.getByRole("tablist"),
      page.getByRole("button", { name: "Nova excursió", exact: true }),
    ]) {
      await expect(locator).toBeInViewport({ ratio: 1 });
    }
    const board = await page.locator(".board-grid").boundingBox();
    expect(board).not.toBeNull();
    if (viewport.width <= 600) {
      expect(board?.x).toBe(0);
      expect(board?.width).toBe(viewport.width);
    }
    expect(
      await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      })),
    ).toEqual(viewport);
    await page.getByRole("tab", { name: "El cistell", exact: true }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Talents passius");
    await expect(page.getByRole("tablist")).toBeInViewport({ ratio: 1 });
    await page.getByRole("tab", { name: "L’excursió", exact: true }).click();
    await expect(page.locator(".tile").nth(44)).toHaveClass(/needs-picking/);
    await page.locator(".tile").nth(44).click();
    await page.locator(".tile").nth(44).click();
    await page.locator(".tile").nth(99).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Tanca", exact: true })
      .click();
    await expect(page.locator(".phase-button")).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".board-grid")).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("tablist")).toBeInViewport({ ratio: 1 });
  });
}

test("tabs support keyboard navigation and retain the selected tool and board", async ({
  page,
}) => {
  await seed(page, initialSave());
  await page.getByRole("button", { name: "Marca", exact: true }).click();
  await page.locator(".tile").first().click();
  const forest = page.getByRole("tab", { name: "L’excursió", exact: true });
  await forest.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "El cistell", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("El cistell");
  await page.keyboard.press("End");
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName(
    "El meu quadern",
  );
  await page.keyboard.press("Home");
  await expect(forest).toBeFocused();
  await expect(forest).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "Marca", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".tile").first()).toHaveAccessibleName(
    "A1, marcada",
  );
});
