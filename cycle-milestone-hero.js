/* ============================================================
   TSUKI 🌙 — REGULAR-CYCLE MILESTONE HERO
   Rotates the Today prediction card through the next useful milestone for
   regular cycles only, and keeps Calendar prediction visuals aligned with
   the same central forecast used by Day Details. Calendar ovulation timing remains an estimate.
   ============================================================ */
(() => {
  "use strict";
  if (window.TsukiCycleMilestoneHero?.installed) return;

  const VERSION = "1.0.0-pre-cycle-milestones-4";
  const $ = selector => document.querySelector(selector);

  function cyclePattern() {
    try {
      return typeof cyclePatternSetting === "function"
        ? cyclePatternSetting()
        : data?.settings?.cyclePattern || "regular";
    }
    catch (_) {
      return data?.settings?.cyclePattern || "regular";
    }
  }

  function isRegularCycle() {
    return data?.mode === "cycle" && cyclePattern() === "regular";
  }

  function safeDate(value) {
    try { return typeof parseDate === "function" ? parseDate(value) : null; }
    catch (_) { return null; }
  }

  function dayDiff(from, to) {
    try { return typeof daysBetween === "function" ? daysBetween(from, to) : null; }
    catch (_) { return null; }
  }

  function dateText(date) {
    try { return typeof formatDate === "function" ? formatDate(date) : "—"; }
    catch (_) { return "—"; }
  }

  function currentPeriodMilestone(todayKeyValue, today) {
    let period = null;
    try { period = typeof periodForDate === "function" ? periodForDate(todayKeyValue) : null; }
    catch (_) {}
    if (!period) return null;

    const start = safeDate(period.start);
    let end = safeDate(period.end);
    if (!end && start) {
      try {
        const length = Math.max(1, Number(data?.settings?.periodLength) || (typeof averagePeriodLength === "function" ? averagePeriodLength() : 5));
        end = addDays(start, length - 1);
      }
      catch (_) {}
    }
    if (!start || !end) return null;

    const remaining = Math.max(0, dayDiff(today, end) ?? 0);
    const countdown = remaining === 0
      ? "Period ending today"
      : remaining === 1
        ? "Period ending tomorrow"
        : `Period ending in ${remaining} days`;

    return {
      kind: "period",
      label: "Current period",
      primary: `${dateText(start)} – ${dateText(end)}`,
      countdown,
      badge: null
    };
  }

  function ovulationMilestone(todayKeyValue, today) {
    let timing = null;
    try { timing = typeof cycleTimingForDate === "function" ? cycleTimingForDate(todayKeyValue) : null; }
    catch (_) {}
    if (!timing?.estimatedOvulation) return null;

    const ovulation = new Date(timing.estimatedOvulation);
    const windowStart = new Date(timing.ovulationWindowStart || ovulation);
    const windowEnd = new Date(timing.ovulationWindowEnd || ovulation);

    if (today < windowStart) {
      const remaining = Math.max(0, dayDiff(today, ovulation) ?? 0);
      return {
        kind: "ovulation",
        label: "Estimated ovulation",
        primary: dateText(ovulation),
        countdown: remaining === 0
          ? "Estimated ovulation today"
          : remaining === 1
            ? "Ovulation estimate in 1 day"
            : `Ovulation estimate in ${remaining} days`,
        badge: "Calendar estimate"
      };
    }

    if (today <= windowEnd) {
      const centerDiff = dayDiff(today, ovulation) ?? 0;
      return {
        kind: "ovulation",
        label: "Estimated ovulation",
        primary: `${dateText(windowStart)} – ${dateText(windowEnd)}`,
        countdown: centerDiff === 0 ? "Estimated ovulation today" : "Estimated ovulation window now",
        badge: "Calendar estimate"
      };
    }

    return null;
  }

  function periodForecastMilestone(today) {
    let windowData = null;
    try { windowData = typeof estimatedWindow === "function" ? estimatedWindow() : null; }
    catch (_) {}
    if (!windowData?.center || !windowData?.start || !windowData?.end) return null;

    const center = new Date(windowData.center);
    const start = new Date(windowData.start);
    const end = new Date(windowData.end);
    let countdown = "Tsuki is still learning your timing";

    if (today < start) {
      const remaining = Math.max(0, dayDiff(today, center) ?? 0);
      countdown = remaining === 1 ? "Period in 1 day" : `Period in ${remaining} days`;
    }
    else if (today <= end) {
      const centerDiff = dayDiff(today, center) ?? 0;
      if (centerDiff > 0) countdown = `Period expected in ${centerDiff} day${centerDiff === 1 ? "" : "s"}`;
      else if (centerDiff === 0) countdown = "Period expected around today";
      else countdown = "Expected period window is still open";
    }
    else {
      const passed = Math.max(1, dayDiff(end, today) ?? 1);
      countdown = `Expected period window passed ${passed} day${passed === 1 ? "" : "s"} ago`;
    }

    return {
      kind: "next-period",
      label: "Next period",
      primary: `${dateText(start)} – ${dateText(end)}`,
      countdown,
      badge: "prediction"
    };
  }

  function milestoneForToday() {
    if (!isRegularCycle()) return null;
    if (typeof todayKey !== "function") return null;
    const key = todayKey();
    const today = safeDate(key);
    if (!today) return null;

    return currentPeriodMilestone(key, today)
      || ovulationMilestone(key, today)
      || periodForecastMilestone(today);
  }

  function applyBadge(mode) {
    const badge = $("#predictionConfidence");
    if (!badge) return;

    badge.classList.remove("hidden");
    if (mode === null) {
      badge.classList.add("hidden");
      return;
    }

    if (mode === "Calendar estimate") {
      badge.textContent = mode;
      badge.className = "confidence-badge confidence-low";
      badge.setAttribute("aria-label", "Calendar-based ovulation estimate; this does not confirm ovulation");
      return;
    }

    try {
      const confidence = typeof predictionConfidence === "function" ? predictionConfidence() : null;
      if (confidence) {
        badge.textContent = `${confidence.level} confidence`;
        badge.className = `confidence-badge ${confidence.className}`;
        badge.setAttribute("aria-label", "Next-period prediction confidence");
      }
    }
    catch (_) {}
  }

  function restoreDefaultLabel() {
    const card = $("#periodCountdownText")?.closest(".prediction-card");
    const label = card?.querySelector(".small-label");
    if (label && label.textContent !== "Next period") label.textContent = "Next period";
  }

  function apply() {
    const milestone = milestoneForToday();
    if (!milestone) {
      restoreDefaultLabel();
      return;
    }

    const card = $("#periodCountdownText")?.closest(".prediction-card");
    const label = card?.querySelector(".small-label");
    const primary = $("#nextPeriodText");
    const countdown = $("#periodCountdownText");

    if (label && label.textContent !== milestone.label) label.textContent = milestone.label;
    if (primary && primary.textContent !== milestone.primary) primary.textContent = milestone.primary;
    if (countdown && countdown.textContent !== milestone.countdown) countdown.textContent = milestone.countdown;
    applyBadge(milestone.badge);
  }


  function calendarProjectionState(key) {
    const date = safeDate(key);
    let actualPeriod = null;
    let anchor = null;
    let phase = "";
    let cycleDay = null;
    let inStartWindow = false;
    let projectedCycle = false;

    try { actualPeriod = typeof periodForDate === "function" ? periodForDate(key) : null; }
    catch (_) {}
    try { anchor = typeof latestPeriod === "function" ? latestPeriod() : null; }
    catch (_) {}

    if (!date) {
      return { date, actualPeriod, phase, cycleDay, inStartWindow, projectedCycle };
    }

    const anchorDate = safeDate(anchor?.start);
    const usesProjectedCalendar = Boolean(anchorDate && date >= anchorDate);

    try {
      phase = usesProjectedCalendar && typeof projectedPhaseForDate === "function"
        ? projectedPhaseForDate(key)
        : typeof phaseForDate === "function"
          ? phaseForDate(key)
          : "";
    }
    catch (_) {}

    try {
      cycleDay = usesProjectedCalendar && typeof projectedCycleDayForDate === "function"
        ? projectedCycleDayForDate(key)
        : typeof cycleDayForDate === "function"
          ? cycleDayForDate(key)
          : null;
    }
    catch (_) {}

    try {
      const windows = typeof calendarPredictionWindows === "function"
        ? calendarPredictionWindows(12)
        : [];
      inStartWindow = typeof dateInAnyPredictionWindow === "function"
        ? dateInAnyPredictionWindow(date, windows)
        : false;
    }
    catch (_) {}

    try {
      const projectedStart = usesProjectedCalendar && typeof projectedCycleStartForDate === "function"
        ? projectedCycleStartForDate(key)
        : null;
      const projectedStartKey = projectedStart && typeof dateKey === "function"
        ? dateKey(projectedStart)
        : "";
      projectedCycle = Boolean(projectedStartKey && anchor?.start && projectedStartKey !== anchor.start);
    }
    catch (_) {}

    return { date, actualPeriod, phase, cycleDay, inStartWindow, projectedCycle };
  }

  function ensureCalendarPredictionStyles() {
    if (document.getElementById("tsuki-calendar-prediction-clarity")) return;

    const style = document.createElement("style");
    style.id = "tsuki-calendar-prediction-clarity";
    style.textContent = `
      .calendar-day.predicted-period:not(.period-range) {
        background: var(--pink-200) !important;
        color: var(--pink-600) !important;
        font-weight: 800;
      }

      .calendar-day.prediction-start-window:not(.period-range) {
        box-shadow: inset 0 0 0 1.5px rgba(217, 87, 136, .42);
      }

      .legend-dot.predicted-period {
        background: var(--pink-200);
        border: 1px solid rgba(217, 87, 136, .22);
      }

      .legend-dot.prediction-start-window {
        background: transparent;
        border: 1.5px solid var(--pink-400);
      }
    `;
    document.head.appendChild(style);
  }

  function syncCalendarPredictionLegend() {
    const legend = $(".calendar-legend");
    if (!legend) return;

    let predictedItem = legend.querySelector('[data-calendar-legend="predicted-period"]');
    if (!predictedItem) {
      predictedItem = legend.querySelector(".legend-dot.predicted")?.closest("span") || null;
      if (predictedItem) predictedItem.dataset.calendarLegend = "predicted-period";
    }

    if (predictedItem) {
      predictedItem.innerHTML = '<i class="legend-dot predicted-period"></i>Predicted period';
    }

    let startWindowItem = legend.querySelector('[data-calendar-legend="prediction-start-window"]');
    if (!startWindowItem) {
      startWindowItem = document.createElement("span");
      startWindowItem.dataset.calendarLegend = "prediction-start-window";
      startWindowItem.innerHTML = '<i class="legend-dot prediction-start-window"></i>Possible start';
      if (predictedItem) predictedItem.insertAdjacentElement("afterend", startWindowItem);
      else legend.prepend(startWindowItem);
    }

    const note = document.querySelector('[data-screen="calendar"] .soft-note');
    if (note) {
      note.textContent =
        "Filled pink dates show Tsuki’s central predicted period days. Pink outlined dates show the possible Day 1 start window. Predictions use your Typical Cycle Length from your latest logged period, and shift when you log the next actual start.";
    }
  }

  function applyCalendarPredictionClarity() {
    ensureCalendarPredictionStyles();
    syncCalendarPredictionLegend();

    document.querySelectorAll("#calendarGrid .calendar-day[data-date]").forEach(button => {
      const state = calendarProjectionState(button.dataset.date || "");

      /* app.js historically used .predicted for the ± start-date uncertainty
         window, which made that window look like the predicted period itself.
         Remove that ambiguous fill, then render the two concepts separately. */
      button.classList.remove("predicted", "predicted-period", "prediction-start-window");

      if (state.actualPeriod) return;
      if (state.phase === "Predicted period") button.classList.add("predicted-period");
      if (state.inStartWindow) button.classList.add("prediction-start-window");
    });
  }

  function decorateDayDetailPrediction(key) {
    const content = $("#dayDetailContent");
    if (!content) return;

    const state = calendarProjectionState(key);
    const summarySmall = content.querySelector(".day-detail-summary small");

    if (summarySmall && state.cycleDay) {
      summarySmall.textContent = `${state.projectedCycle ? "Projected " : ""}Cycle Day ${state.cycleDay}`;
    }

    content.querySelectorAll(".day-detail-chips span").forEach(chip => {
      if (chip.textContent.includes("Estimated period window")) {
        chip.textContent = "🌸 Possible period start window";
      }
    });
  }

  function wrap() {
    if (typeof renderToday === "function" && !renderToday.__cycleMilestoneWrapped) {
      const base = renderToday;
      const wrapped = function(...args) {
        const result = base.apply(this, args);
        /* Apply in the same render turn so the generic forecast never gets a
           dedicated painted frame before the regular-cycle milestone. */
        apply();
        return result;
      };
      wrapped.__cycleMilestoneWrapped = true;
      renderToday = wrapped;
      window.renderToday = wrapped;
    }

    if (typeof renderCalendar === "function" && !renderCalendar.__calendarPredictionClarityWrapped) {
      const base = renderCalendar;
      const wrapped = function(...args) {
        const result = base.apply(this, args);
        applyCalendarPredictionClarity();
        return result;
      };
      wrapped.__calendarPredictionClarityWrapped = true;
      renderCalendar = wrapped;
      window.renderCalendar = wrapped;
    }

    if (typeof openDayDetail === "function" && !openDayDetail.__calendarPredictionClarityWrapped) {
      const base = openDayDetail;
      const wrapped = function(key, ...args) {
        const result = base.call(this, key, ...args);
        decorateDayDetailPrediction(key);
        return result;
      };
      wrapped.__calendarPredictionClarityWrapped = true;
      openDayDetail = wrapped;
      window.openDayDetail = wrapped;
    }

    if (typeof showScreen === "function" && !showScreen.__cycleMilestoneWrapped) {
      const base = showScreen;
      const wrapped = function(name, ...args) {
        const result = base.call(this, name, ...args);
        if (name === "today") apply();
        return result;
      };
      wrapped.__cycleMilestoneWrapped = true;
      showScreen = wrapped;
      window.showScreen = wrapped;
    }
  }

  function install() {
    if (window.TsukiCycleMilestoneHero?.installed) return;
    wrap();
    apply();
    applyCalendarPredictionClarity();
    window.TsukiCycleMilestoneHero = {
      installed: true,
      version: VERSION,
      apply,
      applyCalendarPredictionClarity,
      test: { milestoneForToday, calendarProjectionState }
    };
  }

  window.TsukiCycleMilestoneHero = { installed: false, version: VERSION, install };
  install();
})();