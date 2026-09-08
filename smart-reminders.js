/* ============================================================
   TSUKI 🌙 — SMART REMINDERS BOOTSTRAP
   Keeps the existing Smart Reminders runtime intact while loading the
   phase-aware cycle/reproductive, medical, and UI enhancements after
   the core app is ready.
   ============================================================ */
(() => {
  "use strict";

  function ensureStylesheet(src, key) {
    if (document.querySelector(`link[data-tsuki-style="${key}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = src;
    link.dataset.tsukiStyle = key;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-tsuki-runtime="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "1") resolve();
        else existing.addEventListener("load", resolve, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.tsukiRuntime = src;
      script.addEventListener("load", () => {
        script.dataset.loaded = "1";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function previousDateKey(key) {
    try {
      const date = typeof parseDate === "function" ? parseDate(key) : null;
      if (!date || typeof addDays !== "function" || typeof dateKey !== "function") return "";
      return dateKey(addDays(date, -1));
    }
    catch (_) {
      return "";
    }
  }

  function nextDateKey(key) {
    try {
      const date = typeof parseDate === "function" ? parseDate(key) : null;
      if (!date || typeof addDays !== "function" || typeof dateKey !== "function") return "";
      return dateKey(addDays(date, 1));
    }
    catch (_) {
      return "";
    }
  }

  function periodDuration(period) {
    try {
      const start = typeof parseDate === "function" ? parseDate(period?.start) : null;
      const end = typeof parseDate === "function" ? parseDate(period?.end) : null;
      if (!start || !end || typeof daysBetween !== "function") return null;
      return Math.max(1, daysBetween(start, end) + 1);
    }
    catch (_) {
      return null;
    }
  }

  /* Keep common abdominal cramping available in the full symptom list.
     Existing Daily Check-in save/restore and severity handlers operate on
     input[name="symptom"], so this uses the same built-in symptom contract. */
  function installBellyCrampsSymptom() {
    const grid = document.getElementById("symptomChoiceGrid");
    if (!grid || grid.querySelector('input[name="symptom"][value="Belly Cramps"]')) return;

    const label = document.createElement("label");
    label.dataset.tsukiBuiltInSymptom = "belly-cramps";
    label.innerHTML = '<input type="checkbox" name="symptom" value="Belly Cramps"><span>🌙 Belly cramps</span>';

    const backPainLabel = grid.querySelector('input[name="symptom"][value="Back Pain"]')?.closest("label");
    if (backPainLabel) backPainLabel.insertAdjacentElement("afterend", label);
    else grid.appendChild(label);

    const key = document.getElementById("logDate")?.value || "";
    const saved = key && typeof data === "object" ? data?.logs?.[key]?.symptoms : null;
    const input = label.querySelector('input[name="symptom"]');
    if (input) input.checked = Array.isArray(saved) && saved.includes("Belly Cramps");
  }

  /* Period boundaries should follow what the user actually logs.
     This runs on document capture so it happens before the form-level
     phase/save handlers in app.js and body-signals.js. */
  function installAdaptivePeriodBoundaries() {
    if (document.documentElement.dataset.tsukiAdaptivePeriodBoundaries === "1") return;
    document.documentElement.dataset.tsukiAdaptivePeriodBoundaries = "1";

    document.addEventListener("submit", event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.id !== "dailyLogForm") return;
      if (typeof data !== "object" || data?.mode !== "cycle" || !Array.isArray(data?.periods)) return;

      const flowInput = form.querySelector('input[name="flow"]:checked');
      if (!flowInput) return;

      const flow = flowInput.value;
      const key = document.getElementById("logDate")?.value || (typeof todayKey === "function" ? todayKey() : "");
      if (!key) return;

      let changedPeriod = null;
      let action = "";

      if (["None", "Spotting"].includes(flow)) {
        const containing = data.periods.find(period =>
          period?.start && period?.end && key >= period.start && key <= period.end
        );

        /* Never erase a period from its first recorded day automatically.
           That requires an explicit Cycle History edit. */
        if (containing && key !== containing.start) {
          const newEnd = previousDateKey(key);
          if (newEnd && newEnd >= containing.start && newEnd < containing.end) {
            containing.end = newEnd;
            changedPeriod = containing;
            action = flow === "Spotting" ? "ended-before-spotting" : "ended";
          }
        }
      }
      else if (["Light", "Medium", "Heavy"].includes(flow)) {
        /* Respect a bleeding episode the user explicitly marked as separate.
           Re-saving that day's check-in must not silently merge it later. */
        const existingLog = data.logs?.[key] || null;
        if (existingLog?.bleedingContext === "not-period") return;

        /* Only extend through a directly adjacent day. A gap stays separate
           so Tsuki never silently merges two bleeding episodes. */
        const candidates = data.periods
          .filter(period => period?.start && period?.end && nextDateKey(period.end) === key)
          .sort((a, b) => String(b.start).localeCompare(String(a.start)));
        const adjacent = candidates[0] || null;

        if (adjacent) {
          adjacent.end = key;
          changedPeriod = adjacent;
          action = "extended";
        }
      }

      if (!changedPeriod || typeof saveData !== "function") return;

      saveData();
      const days = periodDuration(changedPeriod);

      /* The normal submit handlers now save the check-in and render from the
         corrected period boundary. Toast after that work completes. */
      setTimeout(() => {
        if (typeof showToast !== "function") return;
        if (action === "extended") {
          showToast(`Period extended${days ? ` to ${days} day${days === 1 ? "" : "s"}` : ""} 🩸`);
        }
        else if (action === "ended-before-spotting") {
          showToast(`Period ended${days ? ` after ${days} day${days === 1 ? "" : "s"}` : ""}; spotting kept separate 🌙`);
        }
        else {
          showToast(`Period ended${days ? ` after ${days} day${days === 1 ? "" : "s"}` : ""} 🌙`);
        }
      }, 0);
    }, true);
  }

  /* Load visual fixes immediately when this parser-blocking bootstrap runs.
     These are also cached by the service worker for offline launches. */
  ensureStylesheet("./ui-polish.css", "ui-polish");
  ensureStylesheet("./period-modal-scroll-fix.css", "period-modal-scroll-fix");
  installBellyCrampsSymptom();
  installAdaptivePeriodBoundaries();

  /* The Today milestone is intentionally first. It corrects the generic
     forecast card before the heavier optional intelligence layers load. */
  loadScript("./cycle-milestone-hero.js")
    .then(() => loadScript("./smart-reminders-core.js"))
    .then(() => loadScript("./cycle-reproductive-enhancements.js"))
    .then(() => loadScript("./cycle-phase-guidance.js"))
    .then(() => loadScript("./cycle-phase-dedupe.js"))
    .then(() => loadScript("./medical-accuracy-hardening.js"))
    .then(() => loadScript("./plans-travel-ux.js"))
    .then(() => loadScript("./moon-garden-fix.js"))
    .catch(error => console.error("Tsuki runtime enhancement load failed:", error));
})();

/* Cloud Backup is intentionally separate from authentication. Loading this
   module never uploads data by itself; it only installs the opt-in backup UI,
   restore-first protection, and new-device cloud inspection. */
import("./firebase-backup.js").catch(error => {
  console.error("Tsuki Cloud Backup could not load:", error);
});
