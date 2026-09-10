import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { expect, test as base } from "@playwright/test";

// Give each test its own origin and deploy two releases without modifying the
// production server or mocking the browser's service worker lifecycle.
const test = base.extend<{
  deployment: { url: string; publishUpdate: () => void };
}>({
  deployment: async ({ baseURL }, runTest) => {
    if (!baseURL) throw new Error("The production server URL is required");
    const worker = await readFile("public/sw.js", "utf8");
    let release = 1;
    const server = createServer(async (request, response) => {
      try {
        const path = request.url ?? "/";
        if (path === "/sw.js") {
          response.writeHead(200, {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-store",
          });
          response.end(
            worker.replace(
              /const CACHE = "[^"]+";/,
              `const CACHE = "buscabolets-test-${release}";`,
            ),
          );
          return;
        }
        const upstream = await fetch(new URL(path, baseURL));
        response.writeHead(upstream.status, {
          "Content-Type": upstream.headers.get("content-type") ?? "text/plain",
          "Cache-Control": "no-store",
        });
        if (path === "/") {
          response.end(
            (await upstream.text()).replace(
              "<head>",
              `<head><meta name="test-release" content="${release}">`,
            ),
          );
        } else {
          response.end(Buffer.from(await upstream.arrayBuffer()));
        }
      } catch {
        response.writeHead(502);
        response.end();
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("The test server did not bind a port");
    try {
      await runTest({
        url: `http://127.0.0.1:${address.port}`,
        publishUpdate: () => {
          release = 2;
        },
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
});

test("a downloaded update waits for consent, preserves the game and works offline", async ({
  page,
  context,
  deployment,
}, testInfo) => {
  await page.goto(deployment.url);
  await page.getByRole("button", { name: "Cap al bosc" }).click();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const update = page.getByRole("button", {
    name: "Actualitza ara",
    exact: true,
  });
  await expect(update).toHaveCount(0);
  await page.getByRole("button", { name: "Marca", exact: true }).click();
  await page.locator(".tile").first().click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("buscabolets-v1"),
  );

  deployment.publishUpdate();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await expect(update).toBeVisible();
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
    "content",
    "1",
  );
  await page.screenshot({ path: testInfo.outputPath("update-available.png") });

  // An already-waiting update must still be offered after a normal refresh.
  await page.reload();
  await expect(update).toBeVisible();
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
    "content",
    "1",
  );
  const otherTab = await context.newPage();
  await otherTab.goto(deployment.url);
  await expect(
    otherTab.getByRole("button", { name: "Actualitza ara", exact: true }),
  ).toBeVisible();

  // Activation and the subsequent reload use the fully downloaded release.
  await context.setOffline(true);
  await update.click();
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
    "content",
    "2",
  );
  await expect(otherTab.locator('meta[name="test-release"]')).toHaveAttribute(
    "content",
    "2",
  );
  await expect(update).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "A1, marcada", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("buscabolets-v1")),
  ).toBe(saved);
  await page.reload();
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
    "content",
    "2",
  );
  await expect(page.locator(".tile")).toHaveCount(100);
});

test("reconnecting discovers an update and a failed save prevents activation", async ({
  page,
  deployment,
}) => {
  await page.goto(deployment.url);
  await page.getByRole("button", { name: "Cap al bosc" }).click();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  deployment.publishUpdate();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const update = page.getByRole("button", {
    name: "Actualitza ara",
    exact: true,
  });
  await expect(update).toBeVisible();

  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
    window.addEventListener(
      "restore-storage",
      () => {
        Storage.prototype.setItem = setItem;
      },
      { once: true },
    );
  });
  await update.click();
  await expect(
    page.getByText("No hem pogut desar la partida.", { exact: false }),
  ).toBeVisible();
  await expect(update).toBeEnabled();
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
    "content",
    "1",
  );
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.ready).waiting?.state,
    ),
  ).toBe("installed");

  await page.evaluate(() => window.dispatchEvent(new Event("restore-storage")));
  await update.click();
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
    "content",
    "2",
  );
  await expect(update).toHaveCount(0);
});
