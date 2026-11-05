// Browser integration checks. Every request is intercepted: no live analytics traffic.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const origin = "https://www.dubsar.be";
const measurementId = "G-T9GTMR6FPV";
const key = "dubsar-analytics-consent";
const files = [
  "index.html",
  "services.html",
  "about-us.html",
  "contact.html",
  "privacy.html",
];
const locales = { fr: "", nl: "nl/", en: "en/" };
const labels = {
  fr: ["Refuser", "Accepter"],
  nl: ["Weigeren", "Accepteren"],
  en: ["Refuse", "Accept"],
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const contexts = [];
  let pageChecks = 0;
  async function fixture(init) {
    const context = await browser.newContext();
    contexts.push(context);
    const googleRequests = [];
    const errors = [];
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        googleRequests.push(url.href);
        assert.equal(
          url.href,
          `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
        );
        await route.fulfill({
          contentType: "application/javascript",
          body: `window.googleTagLoaded = true; document.cookie = '_ga=test; Path=/; Domain=.dubsar.be; Secure; SameSite=Lax';`,
        });
        return;
      }
      const filename = path.resolve(
        root,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
      assert.ok(filename.startsWith(root + path.sep));
      const types = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
      };
      await route.fulfill({
        contentType: types[path.extname(filename)],
        body: await fs.readFile(filename),
      });
    });
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    return { context, page, googleRequests, errors };
  }
  const banner = (page) => page.locator(".analytics-consent");
  const choose = (page, language, granted) =>
    banner(page)
      .getByRole("button", {
        name: labels[language][granted ? 1 : 0],
        exact: true,
      })
      .click();

  try {
    // No Google request on first visit or refusal; choice follows language changes.
    for (const [language, prefix] of Object.entries(locales)) {
      const f = await fixture();
      await f.page.goto(origin + "/" + prefix + "index.html");
      assert.ok(await banner(f.page).isVisible());
      assert.equal(f.googleRequests.length, 0);
      await choose(f.page, language, false);
      assert.ok(await banner(f.page).isHidden());
      await f.page.goto(origin + "/en/contact.html");
      assert.ok(await banner(f.page).isHidden());
      assert.equal(f.googleRequests.length, 0);
      assert.deepEqual(f.errors, []);
    }

    // Acceptance loads one tag and one page view, with clean URLs, on every page.
    const f = await fixture();
    await f.page.goto(origin + "/");
    await choose(f.page, "fr", true);
    await f.page.waitForFunction(() => window.googleTagLoaded);
    assert.equal(f.googleRequests.length, 1);
    await f.page.locator("[data-analytics-settings]").click();
    await choose(f.page, "fr", true);
    assert.equal(
      f.googleRequests.length,
      1,
      "Reopening preferences must not duplicate tracking",
    );
    for (const prefix of Object.values(locales)) {
      for (const file of files) {
        const pathname = "/" + prefix + file;
        await f.page.goto(
          origin + pathname + "?email=private@example.com#private",
          {
            referer: origin + "/contact.html?email=private@example.com",
          },
        );
        await f.page.waitForFunction(() => window.googleTagLoaded);
        assert.ok(await banner(f.page).isHidden());
        const commands = await f.page.evaluate(() =>
          window.dataLayer.map((args) => Array.from(args)),
        );
        const config = commands.filter((command) => command[0] === "config");
        const views = commands.filter(
          (command) => command[0] === "event" && command[1] === "page_view",
        );
        assert.equal(config.length, 1);
        assert.equal(config[0][1], measurementId);
        assert.equal(config[0][2].send_page_view, false);
        assert.equal(config[0][2].allow_google_signals, false);
        assert.equal(config[0][2].allow_ad_personalization_signals, false);
        assert.equal(views.length, 1);
        assert.equal(views[0][2].page_location, origin + pathname);
        assert.equal(views[0][2].page_referrer, origin + "/contact.html");
        assert.ok(!JSON.stringify(commands).includes("private@example.com"));
        assert.equal(
          await f.page.locator("[data-analytics-settings]").count(),
          1,
        );
        pageChecks++;
      }
    }
    assert.equal(f.googleRequests.length, 16);

    // Withdrawal deletes host and parent-domain GA cookies, preserves unrelated cookies.
    await f.context.addCookies([
      {
        name: "_ga_T9GTMR6FPV",
        value: "host",
        domain: "www.dubsar.be",
        path: "/",
        secure: true,
      },
      {
        name: "_ga_OTHER",
        value: "parent",
        domain: ".dubsar.be",
        path: "/",
        secure: true,
      },
      {
        name: "unrelated",
        value: "keep",
        domain: ".dubsar.be",
        path: "/",
        secure: true,
      },
    ]);
    await f.page.locator("[data-analytics-settings]").click();
    const previousRequests = f.googleRequests.length;
    await Promise.all([
      f.page.waitForEvent("load"),
      choose(f.page, "en", false),
    ]);
    assert.ok(await banner(f.page).isHidden());
    assert.equal(f.googleRequests.length, previousRequests);
    const cookies = await f.context.cookies();
    assert.ok(
      !cookies.some(
        (cookie) => cookie.name === "_ga" || cookie.name.startsWith("_ga_"),
      ),
    );
    assert.ok(cookies.some((cookie) => cookie.name === "unrelated"));
    assert.equal(
      await f.page.evaluate(
        (name) => JSON.parse(localStorage.getItem(name)).choice,
        key,
      ),
      "denied",
    );
    assert.deepEqual(f.errors, []);

    // Consent does not survive invalid/expired state, and storage failures stay safe.
    for (const value of [
      "not-json",
      JSON.stringify({ choice: "granted", expires: 1 }),
    ]) {
      const invalid = await fixture();
      await invalid.context.addInitScript(
        ({ key, value }) => localStorage.setItem(key, value),
        { key, value },
      );
      await invalid.page.goto(origin + "/");
      assert.ok(await banner(invalid.page).isVisible());
      assert.equal(invalid.googleRequests.length, 0);
    }
    const blocked = await fixture(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Storage blocked", "SecurityError");
        },
      }),
    );
    await blocked.page.goto(origin + "/en/index.html");
    assert.ok(await banner(blocked.page).isVisible());
    assert.equal(blocked.googleRequests.length, 0);
    await choose(blocked.page, "en", true);
    await blocked.page.waitForFunction(() => window.googleTagLoaded);
    await blocked.page.locator("[data-analytics-settings]").click();
    await Promise.all([
      blocked.page.waitForEvent("load"),
      choose(blocked.page, "en", false),
    ]);
    assert.ok(await banner(blocked.page).isVisible());
    assert.equal(blocked.googleRequests.length, 1);
    assert.deepEqual(blocked.errors, []);

    // Restored pages must recheck consent even if a storage event was missed.
    const restored = await fixture();
    await restored.page.goto(origin + "/en/index.html");
    await choose(restored.page, "en", true);
    await restored.page.waitForFunction(() => window.googleTagLoaded);
    await Promise.all([
      restored.page.waitForEvent("load"),
      restored.page.evaluate((name) => {
        localStorage.setItem(
          name,
          JSON.stringify({ choice: "denied", expires: Date.now() + 60000 }),
        );
        window.dispatchEvent(
          new PageTransitionEvent("pageshow", { persisted: true }),
        );
      }, key),
    ]);
    assert.equal(restored.googleRequests.length, 1);
    assert.ok(await banner(restored.page).isHidden());

    // Fresh consent controls fit narrow screens and are usable from the keyboard.
    const mobile = await fixture();
    for (const width of [320, 390, 1440]) {
      await mobile.page.setViewportSize({ width, height: 844 });
      await mobile.page.goto(origin + "/nl/index.html");
      const bounds = await banner(mobile.page).boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      for (const action of await banner(mobile.page)
        .getByRole("button")
        .all()) {
        const box = await action.boundingBox();
        assert.ok(box.height >= 44);
      }
    }
    await mobile.page.locator("[data-analytics-settings]").click();
    assert.equal(await mobile.page.locator(":focus").textContent(), "Weigeren");
    await mobile.page.keyboard.press("Enter");
    assert.ok(await banner(mobile.page).isHidden());
    assert.equal(mobile.googleRequests.length, 0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await browser.close();
  }
  console.log(
    `PASS: ${pageChecks} pages; no pre-consent/refused tracking; consent persistence; one page view per load; URL sanitisation; withdrawal and cookie removal.`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
