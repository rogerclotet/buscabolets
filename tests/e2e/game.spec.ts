import { expect, test } from "@playwright/test";
import { initialSave, SPECIES, type Save } from "../../src/lib/game";

async function seed(page: import("@playwright/test").Page, save: Save) {
  await page.addInitScript(
    (value) => localStorage.setItem("buscabolets-v1", JSON.stringify(value)),
    save,
  );
  await page.goto("/");
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
  }
  await page.getByRole("button", { name: "Marca", exact: true }).click();
  await page
    .getByRole("button", { name: "A1, per explorar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "A1, marcada", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "45");
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
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "45");
  await page
    .getByRole("button", { name: "El meu quadern", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
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
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "45");
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
  await page.getByRole("button", { name: "El boletari", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
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
        .locator(".board-card")
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
      String(45 - Math.ceil(3 / power)),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
