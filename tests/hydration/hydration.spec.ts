import { expect, test } from "@playwright/test";
import { initialSave, transition } from "../../src/lib/game";

for (const restoredButtons of [false, true]) {
  test(`saved run hydrates without console errors${restoredButtons ? " when button enabled state is restored before React" : " on a fresh page"}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text().slice(0, 300));
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const save = transition(initialSave(777), {
      type: "tile",
      index: 0,
      tool: "flag",
    });
    await page.addInitScript((value) => {
      // Seed once so the reload also checks that restored progress is saved.
      if (!localStorage.getItem("buscabolets-v1"))
        localStorage.setItem("buscabolets-v1", JSON.stringify(value));
    }, save);
    if (restoredButtons) {
      await page.addInitScript(() => {
        // Reproduce the reported DOM before hydration without changing the
        // document response or blocking Next's development scripts.
        const tiles = new Set<Element>();
        const observer = new MutationObserver((records) => {
          for (const record of records)
            for (const node of record.addedNodes) {
              if (!(node instanceof Element)) continue;
              const buttons = node.matches("button.tile")
                ? [node]
                : Array.from(node.querySelectorAll("button.tile"));
              for (const button of buttons) {
                if (tiles.has(button)) continue;
                tiles.add(button);
                button.removeAttribute("disabled");
              }
            }
          if (tiles.size === 100) observer.disconnect();
        });
        observer.observe(document, { childList: true, subtree: true });
      });
    }
    await page.goto("/");
    await expect(page.locator(".tile").first()).toHaveAttribute(
      "aria-label",
      "A1, marcada",
    );
    expect(errors).toEqual([]);
    await page
      .getByRole("button", { name: "A1, marcada", exact: true })
      .click({ button: "right" });
    await expect(
      page.getByRole("button", { name: "A1, per explorar", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "A1, per explorar", exact: true }),
    ).toBeVisible();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("buscabolets-v1") ?? "null"),
    );
    expect(saved.run.seed).toBe(777);
    expect(saved.run.flags).toEqual([]);
    expect(errors).toEqual([]);
  });
}
