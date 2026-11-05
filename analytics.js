(() => {
  "use strict";

  const measurementId = "G-T9GTMR6FPV";
  const storageKey = "dubsar-analytics-consent";
  const consentLifetime = 180 * 24 * 60 * 60 * 1000;
  const disableKey = `ga-disable-${measurementId}`;
  const language = document.documentElement.lang.split("-")[0];
  const translations = {
    fr: {
      title: "Mesure d’audience",
      message:
        "Avec votre accord, Google Analytics nous aide à comprendre quelles pages sont consultées. Vous pouvez accepter ou refuser et modifier votre choix à tout moment.",
      privacy: "Confidentialité",
      accept: "Accepter",
      refuse: "Refuser",
      settings: "Préférences de cookies",
    },
    nl: {
      title: "Bezoekstatistieken",
      message:
        "Met jouw toestemming gebruiken we Google Analytics om te zien welke pagina’s worden bezocht. Je kan accepteren of weigeren en je keuze op elk moment wijzigen.",
      privacy: "Privacy",
      accept: "Accepteren",
      refuse: "Weigeren",
      settings: "Cookievoorkeuren",
    },
    en: {
      title: "Website analytics",
      message:
        "With your permission, Google Analytics helps us understand which pages are visited. You can accept or refuse and change your choice at any time.",
      privacy: "Privacy",
      accept: "Accept",
      refuse: "Refuse",
      settings: "Cookie preferences",
    },
  };
  const copy = translations[language] || translations.en;
  let trackingStarted = false;
  let returnFocus = null;
  let choiceExpiryTimer;

  function readChoice() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      if (
        (value?.choice === "granted" || value?.choice === "denied") &&
        Number.isFinite(value.expires) &&
        value.expires > Date.now() &&
        value.expires <= Date.now() + consentLifetime
      ) {
        return value;
      }
    } catch {
      // Storage may be unavailable. An unknown choice never enables analytics.
    }
    return null;
  }

  function saveChoice(choice) {
    const value = { choice, expires: Date.now() + consentLifetime };
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // The visitor's choice still applies to this page if storage is blocked.
    }
    return value;
  }

  function clearAnalyticsCookies() {
    const names = document.cookie
      .split(";")
      .map((cookie) => cookie.trim().split("=")[0])
      .filter((name) => name === "_ga" || name.startsWith("_ga_"));
    const hostname = location.hostname;
    const domains = ["", hostname, `.${hostname}`];
    if (hostname === "www.dubsar.be" || hostname === "dubsar.be") {
      domains.push("dubsar.be", ".dubsar.be");
    }
    for (const name of names) {
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${domain ? `; domain=${domain}` : ""}`;
      }
    }
  }

  function cleanUrl(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol)
        ? url.origin + url.pathname
        : "";
    } catch {
      return "";
    }
  }

  function startTracking() {
    if (trackingStarted) return;
    trackingStarted = true;
    window[disableKey] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    const page = {
      page_location: cleanUrl(location.href),
      page_referrer: cleanUrl(document.referrer),
      page_title: document.title,
    };
    window.gtag("config", measurementId, {
      ...page,
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: consentLifetime / 1000,
      cookie_update: false,
      cookie_flags: "SameSite=Lax;Secure",
    });
    window.gtag("event", "page_view", page);

    const tag = document.createElement("script");
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.append(tag);
  }

  function stopTracking() {
    // A loaded Google runtime can retain listeners. Reload after disabling it.
    window[disableKey] = true;
    clearAnalyticsCookies();
    if (trackingStarted) location.reload();
  }

  const banner = document.createElement("section");
  banner.className = "analytics-consent";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-labelledby", "analytics-consent-title");
  banner.hidden = true;
  const message = document.createElement("div");
  const heading = document.createElement("h2");
  heading.id = "analytics-consent-title";
  heading.textContent = copy.title;
  const explanation = document.createElement("p");
  explanation.textContent = copy.message + " ";
  const privacyLink = document.createElement("a");
  privacyLink.href = "privacy.html";
  privacyLink.textContent = copy.privacy;
  explanation.append(privacyLink);
  message.append(heading, explanation);
  const actions = document.createElement("div");
  actions.className = "analytics-consent-actions";
  const refuse = document.createElement("button");
  const accept = document.createElement("button");
  refuse.type = accept.type = "button";
  refuse.className = accept.className = "analytics-consent-button";
  refuse.textContent = copy.refuse;
  accept.textContent = copy.accept;
  actions.append(refuse, accept);
  banner.append(message, actions);
  document.body.append(banner);

  // Recheck long-lived tabs so an expired choice cannot keep analytics enabled.
  function scheduleExpiry(value) {
    clearTimeout(choiceExpiryTimer);
    if (!value) return;
    choiceExpiryTimer = setTimeout(
      () => {
        if (Date.now() >= value.expires) {
          banner.hidden = false;
          stopTracking();
        } else {
          scheduleExpiry(value);
        }
      },
      Math.min(value.expires - Date.now() + 1, 2147483647),
    );
  }

  function choose(choice) {
    const value = saveChoice(choice);
    scheduleExpiry(value);
    banner.hidden = true;
    if (returnFocus) returnFocus.focus();
    if (choice === "granted") startTracking();
    else stopTracking();
  }

  refuse.addEventListener("click", () => choose("denied"));
  accept.addEventListener("click", () => choose("granted"));
  for (const button of document.querySelectorAll("[data-analytics-settings]")) {
    button.textContent = copy.settings;
    button.hidden = false;
    button.addEventListener("click", () => {
      returnFocus = button;
      banner.hidden = false;
      refuse.focus();
    });
  }

  function applyStoredChoice() {
    const value = readChoice();
    scheduleExpiry(value);
    banner.hidden = Boolean(value);
    if (value?.choice === "granted") startTracking();
    else stopTracking();
  }

  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) applyStoredChoice();
  });
  window.addEventListener("pageshow", (event) => {
    // Back/forward cache can restore a page that missed a consent change.
    if (event.persisted) applyStoredChoice();
  });
  applyStoredChoice();
})();
