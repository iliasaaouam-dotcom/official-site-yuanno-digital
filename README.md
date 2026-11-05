# Dubsar

A simple trilingual website for help with everyday paperwork, based on the original site's home / services / about / contact structure.

- French: root HTML pages (`index.html`, `services.html`, `about-us.html`, `contact.html`, `privacy.html`).
- Dutch: matching pages under `nl/`.
- English: matching pages under `en/`. The FR / NL / EN links preserve the current page.
- Shared styling: `style.css`. No build, third-party fonts, or package installation required. Shared `analytics.js` provides optional Google Analytics and the consent controls; the pages and navigation work without JavaScript.

## Local development

From this checkout:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Check that all three language versions, navigation, local assets, phone links, and email links work. The service FAQ uses native HTML details elements and works without JavaScript.

## Optional analytics

`analytics.js` loads Google Analytics 4 measurement ID `G-T9GTMR6FPV` only after an explicit Accept choice. Refuse is equally available. No Google requests or analytics cookies are permitted before acceptance. The footer preferences control lets visitors change or withdraw their choice.

The choice is stored in local storage under `dubsar-analytics-consent` for 180 days. Analytics cookies expire after at most 180 days (`cookie_expires: 15552000`, `cookie_update: false`). Advertising signals and personalisation are disabled. Our page-view location and referrer values are reduced to origin plus pathname, excluding query strings and fragments. No custom form or email content is sent. Refusing after accepting disables analytics, clears first-party `_ga` / `_ga_*` cookies, and reloads the page; it does not erase data already processed by Google.

For smoke tests, check initial load, refusal, acceptance, saved choices, expiry, and withdrawal in all three languages. Intercept or stub Google script and collection requests in automated tests so smoke checks do not generate live analytics traffic. Confirm no Google requests or analytics cookies before consent, and verify the permitted configuration using the stubs. Test that footer preferences remain available and the site works without JavaScript.

Enhanced measurement is controlled separately in Google Analytics: **Admin → Data streams → your Web stream → Enhanced measurement**. Turn it off if you want only the page views configured by this script. The repository cannot inspect or change that account setting.

Browser regression checks live in `tests/analytics.cjs`. They use Playwright and a Chromium browser, serve the site through intercepted requests, and stub the Google tag so no live tracking occurs. In this cloud environment, run:

```sh
CHROMIUM_PATH=/usr/bin/chromium node tests/analytics.cjs
```

Elsewhere, install Playwright in your test environment and its Chromium browser, or set `CHROMIUM_PATH` to an existing Chromium executable. No dependency installation is needed to serve the website itself.

## Contact

Current contact details displayed across all three language versions:

- +32 485 13 34 41
- info.contact@dubsar.be
- Brussels, Belgium

Contact links open the visitor's phone or email application; there is no server-side form or simulated submission. No price, opening hours, response time, registered business details, or new email address has been invented.

The previous business's logo, analytics configuration, newsletter forms, and unrelated resource pages have been replaced or removed. `CNAME` now specifies `www.dubsar.be`; hosting and DNS must match this domain. The current optional analytics configuration is described above.
