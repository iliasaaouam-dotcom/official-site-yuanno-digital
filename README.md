# Dubsar

A simple bilingual website for help with everyday paperwork, based on the original site's home / services / about / contact structure.

- French: root HTML pages (`index.html`, `services.html`, `about-us.html`, `contact.html`, `privacy.html`).
- Dutch: matching pages under `nl/`. The FR / NL links preserve the current page.
- Shared styling: `style.css`. No build, JavaScript, third-party fonts, analytics, or package installation required.

## Local development

From this checkout:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Check that both language versions, navigation, local assets, phone links, and email links work. The service FAQ uses native HTML details elements and works without JavaScript.

## Contact

The telephone and email are carried over from the original main-branch site:

- +32 485 13 34 41
- ilias.aaouam@yuanno.net
- Brussels, Belgium

Contact links open the visitor's phone or email application; there is no server-side form or simulated submission. No price, opening hours, response time, registered business details, or new email address has been invented.

The previous business's logo, Google Analytics, newsletter forms, unrelated resource pages, and `CNAME` have been removed on this branch. Configure Dubsar's own domain in your hosting settings when it is known. Deployment and the original site on `main` are not changed by these local edits.
