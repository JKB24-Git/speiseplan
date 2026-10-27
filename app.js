(function () {
  "use strict";

  /* ------------------------------------------------------------
     Einstellungen und Texte (hier kannst du alles anpassen)
     Zum Ändern einer Zeile: Datei auf GitHub öffnen, Stift-Symbol klicken,
     Zeile ändern, "Commit changes". Die ganze Datei ersetzen ist nicht nötig.
     ------------------------------------------------------------ */
  var TEXT = {
    loading: "Speiseplan wird geladen …",
    noWeeks: "Es wurde noch kein Speiseplan veröffentlicht.",
    loadError: "Der Speiseplan konnte nicht geladen werden. Bitte später noch einmal versuchen.",
    weekError: "Der Speiseplan für diese Woche kann nicht angezeigt werden.",
    unknownWeek: "Diese Woche wurde nicht gefunden. Angezeigt wird die aktuelle Woche.",
    outdated: "Für die laufende Woche wurde noch kein Speiseplan veröffentlicht. Angezeigt wird der letzte Plan.",
    noNewPlan: "Für die laufende Woche ist noch kein neuer Speiseplan verfügbar.",
    notCurrent: "Dieser Plan ist nicht mehr aktuell.",
    toCurrent: "Zur aktuellen Woche",
    toLatest: "Zur neuesten verfügbaren Woche",
    noEntries: "Keine Angaben",
    today: "Heute",
    calendarWeek: "Kalenderwoche",
    weekOption: "KW {kw} (ab {date})",
    unknownAllergen: "Unbekannter Code",
    allergensPrefix: "Allergene: ",
    detailHint: "Foto und Beschreibung ansehen",
    detailClose: "Schließen",
    zoomHint: "Bild vergrößern",
    zoomClose: "Bild verkleinern",
    linkHint: "Externe Seite öffnen"
  };

  var MEALS = [
    { key: "lunch", label: "Mittagessen" },
    { key: "dinner", label: "Abendessen" }
  ];

  // Essenszeiten: bestimmen, welche Mahlzeit heute als "als Nächstes" markiert wird,
  // und werden neben "Mittagessen"/"Abendessen" angezeigt.
  var MEAL_TIMES = {
    lunch: { start: "12:45", end: "13:30" },
    dinner: { start: "18:00", end: "18:30" }
  };

  var FRIDAY_LUNCH_TIME = { start: "13:00", end: "13:30" };

  function mealTimeFor(day, mealKey) {
    if (mealKey === "lunch" && String(day && day.day || "").trim().toLowerCase() === "freitag") {
      return FRIDAY_LUNCH_TIME;
    }
    return MEAL_TIMES[mealKey];
  }

  function parseHM(hm) {
    var p = hm.split(":");
    return Number(p[0]) * 60 + Number(p[1]);
  }

  function formatRange(t) { return t.start + "–" + t.end; }

  // Nächste veröffentlichte Mahlzeit anhand Datum und Essenszeiten finden.
  function nextMealTarget(days, monday, now) {
    var candidates = [];
    (Array.isArray(days) ? days : []).forEach(function (day) {
      if (!day || typeof day !== "object") return;
      var dayIndex = DAY_NAMES.indexOf(String(day.day || "").trim().toLowerCase());
      if (dayIndex < 0) return;
      var date = addDays(monday, dayIndex);
      MEALS.forEach(function (meal) {
        var items = day[meal.key];
        if (!Array.isArray(items) || !items.length) return;
        var startAt = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        var times = mealTimeFor(day, meal.key);
        startAt.setMinutes(parseHM(times.start), 0, 0);
        var endAt = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        endAt.setMinutes(parseHM(times.end), 0, 0);
        if (endAt <= startAt) endAt.setDate(endAt.getDate() + 1);
        if (endAt > now) candidates.push({ dayIndex: dayIndex, key: meal.key, startsAt: startAt });
      });
    });
    candidates.sort(function (a, b) { return a.startsAt - b.startsAt; });
    return candidates.length ? candidates[0] : null;
  }

  var DAY_NAMES = ["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"];
  var FILE_RE = /^\d{4}-\d{2}-\d{2}\.json$/;

  /* ------------------------------------------------------------
     Hilfsfunktionen
     ------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    // Immer textContent, nie innerHTML: Inhalte aus den Dateien können so keinen Code einschleusen.
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function canHover() {
    return !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function formatDate(d) { return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear(); }
  function formatShort(d) { return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "."; }

  function dateFromFile(file) {
    var p = file.slice(0, 10).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function mondayOf(d) {
    var m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  }

  function addDays(d, n) {
    var r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() + n);
    return r;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // Kalenderwoche nach ISO 8601: Es gibt keine Woche 0. Die Woche mit dem ersten Donnerstag
  // des Jahres ist KW 1. Der 28.12.2026 bis 03.01.2027 ist noch KW 53, KW 1 2027 beginnt am 04.01.2027.
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
    var firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((t - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  }

  function stem(file) { return file.replace(/\.json$/, ""); }

  function fetchJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(url + ": " + res.status);
      return res.json();
    });
  }

  function fetchText(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(url + ": " + res.status);
      return res.text();
    });
  }

  /* ---------- Farben ---------- */

  // Nur #rgb oder #rrggbb erlaubt; alles andere wird ignoriert.
  function validColor(value) {
    if (typeof value !== "string") return null;
    var v = value.trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(v)) v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    return /^#[0-9a-f]{6}$/.test(v) ? v : null;
  }

  // Schwarze oder weiße Schrift, je nachdem was auf der Farbe besser lesbar ist.
  function inkFor(hex) {
    var n = parseInt(hex.slice(1), 16);
    function lin(c) { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    var whiteContrast = 1.05 / (L + 0.05);
    var blackContrast = (L + 0.05) / 0.05;
    return whiteContrast >= blackContrast ? "#ffffff" : "#111111";
  }

  /* ------------------------------------------------------------
     Zustand
     ------------------------------------------------------------ */
  var state = {
    files: [],        // alle Wochen-Dateien, neueste zuerst
    allergens: [],    // Liste in der Reihenfolge von allergens.json
    allergenByCode: {},
    dishes: {},        // Name (getrimmt) -> { image, description } aus dishes.json
    seatingPlans: {},   // geladene Sitzordnungen, nach Datum gecacht
    seatingFiles: {},   // verfügbare Dateien aus sitzordnungen/index.txt
    weekData: {},
    historyFiles: [],
    pendingNavigation: null,
    historyReturn: null,
    restoreDetail: false,
    detailContext: null,
    hideAllergens: true,
    selectedAllergens: {},
    request: 0,        // schützt vor Durcheinander bei schnellem Klicken
    firstView: true    // nur beim ersten Aufbau nicht animieren / zum heutigen Tag scrollen
  };

  var ui = {
    plan: $("plan"),
    notice: $("notice"),
    label: $("week-label"),
    meta: $("week-meta"),
    select: $("week-select"),
    prev: $("prev"),
    next: $("next"),
    legend: $("legend"),
    legendSection: $("allergen-legend"),
    activeAllergens: $("active-allergens"),
    bottomDock: $("bottom-dock"),
    historyReturn: $("history-return"),
    allergenScroll: $("allergen-scroll"),
    panel: document.querySelector(".panel"),
    mastheadText: document.querySelector(".masthead-text"),
    hideAllergens: $("hide-allergens")
  };

  function setAllergens(data) {
    var list = [];
    if (Array.isArray(data)) {
      data.forEach(function (a) {
        if (a && typeof a.code === "string" && a.code.trim()) {
          list.push({ code: a.code.trim().toUpperCase(), name: String(a.name || ""), color: validColor(a.color) });
        }
      });
    } else if (data && typeof data === "object") {
      // Altes Format {"A": "Gluten", ...}: alphabetisch, ohne Farben
      Object.keys(data).sort().forEach(function (code) {
        list.push({ code: code.toUpperCase(), name: String(data[code]), color: null });
      });
    }
    state.allergens = list;
    state.allergenByCode = {};
    list.forEach(function (a, i) { a.order = i; state.allergenByCode[a.code] = a; });
  }

  // dishes.json: { "Genauer Gerichtename": { "image": "images/….jpg", "description": "…" }, … }
  function setDishes(data) {
    var map = {};
    if (data && typeof data === "object" && !Array.isArray(data)) {
      Object.keys(data).forEach(function (name) {
        var entry = data[name];
        if (!entry || typeof entry !== "object") return;
        var image = typeof entry.image === "string" && entry.image.trim() ? entry.image.trim() : null;
        var description = typeof entry.description === "string" && entry.description.trim() ? entry.description.trim() : null;
        var link = typeof entry.link === "string" && entry.link.trim() ? entry.link.trim() : null;
        if (link) {
          try {
            var parsedLink = new URL(link, window.location.href);
            link = parsedLink.protocol === "http:" || parsedLink.protocol === "https:" ? parsedLink.href : null;
          } catch (e) { link = null; }
        }
        var key = name.trim();
        if (key && (image || description || link)) map[key] = { image: image, description: description, link: link };
      });
    }
    state.dishes = map;
  }

  function setSeatingPlanIndex(text) {
    state.seatingFiles = {};
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var filename = line.trim();
      if (/^\d{4}-\d{2}-\d{2}\.json$/.test(filename)) state.seatingFiles[filename.slice(0, 10)] = true;
    });
  }

  function normalizeSeatingPlan(data) {
    return Array.isArray(data) ? data.filter(function (person) {
      return person && Number.isInteger(Number(person.platz)) && Number(person.platz) >= 1 && Number(person.platz) <= 140
        && String(person.vorname || "").trim() && String(person.nachname || "").trim();
    }).map(function (person) {
      return {
        platz: Number(person.platz),
        vorname: String(person.vorname).trim(),
        nachname: String(person.nachname).trim()
      };
    }) : [];
  }

  function fetchSeatingPlan(date) {
    if (!date || !state.seatingFiles[date]) return Promise.resolve(null);
    if (Object.prototype.hasOwnProperty.call(state.seatingPlans, date)) return Promise.resolve(state.seatingPlans[date]);
    return fetchJSON("sitzordnungen/" + date + ".json").then(function (data) {
      state.seatingPlans[date] = normalizeSeatingPlan(data);
      return state.seatingPlans[date];
    }).catch(function () {
      state.seatingPlans[date] = [];
      return [];
    });
  }

  /* ------------------------------------------------------------
     Anzeige
     ------------------------------------------------------------ */
  function syncNoticeStickyHeight() {
    if (ui.notice.hidden) {
      document.body.classList.remove("has-notice");
      document.documentElement.style.setProperty("--notice-sticky-height", "0px");
      return;
    }
    document.body.classList.add("has-notice");
    document.documentElement.style.setProperty("--notice-sticky-height", ui.notice.getBoundingClientRect().height + "px");
  }

  function showNotice(message, linkText, linkHref, actionText, action) {
    ui.notice.textContent = "";
    if (!message) {
      ui.notice.hidden = true;
      syncNoticeStickyHeight();
      return;
    }
    ui.notice.appendChild(document.createTextNode(message));
    if (linkText) {
      ui.notice.appendChild(document.createTextNode(" "));
      var a = el("a", "", linkText);
      a.href = linkHref || "#";
      if (linkText === TEXT.toCurrent || linkText === TEXT.toLatest) {
        var destinationWeek = (linkHref || "").replace(/^#/, "");
        a.addEventListener("click", function () {
          state.pendingNavigation = { week: destinationWeek, scrollToNextMeal: true };
        });
      }
      ui.notice.appendChild(a);
    }
    if (actionText && action) {
      var button = el("button", "notice-action", actionText);
      button.type = "button";
      button.addEventListener("click", action);
      ui.notice.appendChild(button);
    }
    ui.notice.hidden = false;
    syncNoticeStickyHeight();
  }

  function showMessage(message) {
    ui.plan.textContent = "";
    ui.plan.appendChild(el("p", "empty day", message));
  }

  /* ---------- Allergen-Kästchen: Klick (Handy) bzw. Hover (PC, per CSS) klappt den Namen auf ---------- */
  var openChip = null;

  function closeOpenChip() {
    if (openChip) {
      openChip.classList.remove("is-open");
      openChip.setAttribute("aria-expanded", "false");
      openChip = null;
    }
  }

  function positionAllergenName(chip) {
    var label = chip && chip.querySelector(".al-name");
    if (!label) return;
    var r = chip.getBoundingClientRect();
    var width = label.getBoundingClientRect().width;
    var left = Math.max(8, Math.min(window.innerWidth - width - 8, r.left + (r.width - width) / 2));
    label.style.left = (left - r.left) + "px";
    label.style.transform = "none";
    label.style.setProperty("--allergen-arrow-x", (r.left + r.width / 2 - left) + "px");
  }

  // Ein Kästchen; foldable=true fügt den (per Klick/Hover aufklappbaren) Namen hinzu.
  // Ohne foldable bleibt es ein reines Anzeige-Kästchen (z. B. in der Legende, wo der Name schon danebensteht).
  function makeChip(code, foldable, filterable) {
    var info = state.allergenByCode[code];
    var name = info ? info.name : TEXT.unknownAllergen;
    var isButton = foldable || filterable;
    var chip = el(isButton ? "button" : "span", "al" + (foldable ? " al-foldable" : "") + (filterable ? " al-filter" : "") + (info ? "" : " al-unknown"));
    if (isButton) {
      chip.type = "button";
      if (foldable) chip.setAttribute("aria-expanded", "false");
      chip.setAttribute("aria-label", filterable
        ? "Allergen " + code + ": " + name + ". Anklicken, um passende Gerichte rot zu markieren."
        : code + ": " + name);
    }
    chip.setAttribute("data-code", code);
    if (info && info.color) {
      // Über die Style-Eigenschaften (nicht per HTML-Attribut), damit die Sicherheitsregel in index.html nicht stört.
      chip.style.backgroundColor = info.color;
      chip.style.color = inkFor(info.color);
    }
    var letter = el("span", "", code);
    letter.setAttribute("aria-hidden", "true");
    chip.appendChild(letter);
    if (foldable) {
      chip.appendChild(el("span", "al-name", name));
      chip.appendChild(el("span", "sr", name));
    }
    if (filterable) {
      chip.setAttribute("aria-pressed", state.selectedAllergens[code] ? "true" : "false");
      chip.title = "Passende Gerichte hervorheben: " + name;
      chip.addEventListener("click", function () {
        if (suppressAllergenClick) { suppressAllergenClick = false; return; }
        toggleAllergen(code);
      });
    }
    return chip;
  }

  var allergenDrag = null;
  var suppressAllergenClick = false;
  var allergenSuppressTimer = null;
  function toggleAllergen(code, selected) {
    var shouldSelect = typeof selected === "boolean" ? selected : !state.selectedAllergens[code];
    if (shouldSelect) state.selectedAllergens[code] = true;
    else delete state.selectedAllergens[code];
    applyAllergenHighlights();
  }
  function setDraggedAllergen(code, selected) {
    toggleAllergen(code, selected);
  }
  document.addEventListener("pointerdown", function (event) {
    var chip = event.target.closest && event.target.closest(".al-filter");
    if (!chip || event.button !== 0) return;
    var code = chip.getAttribute("data-code");
    allergenDrag = { start: code, selected: !state.selectedAllergens[code], seen: { [code]: true }, moved: false };
  });
  document.addEventListener("pointerover", function (event) {
    if (!allergenDrag) return;
    var chip = event.target.closest && event.target.closest(".al-filter");
    if (!chip) return;
    var code = chip.getAttribute("data-code");
    if (allergenDrag.seen[code]) return;
    allergenDrag.seen[code] = true;
    allergenDrag.moved = true;
    setDraggedAllergen(allergenDrag.start, allergenDrag.selected);
    setDraggedAllergen(code, allergenDrag.selected);
  });
  document.addEventListener("pointerup", function () {
    if (!allergenDrag) return;
    if (allergenDrag.moved) {
      setDraggedAllergen(allergenDrag.start, allergenDrag.selected);
      suppressAllergenClick = true;
      window.clearTimeout(allergenSuppressTimer);
      allergenSuppressTimer = window.setTimeout(function () { suppressAllergenClick = false; }, 150);
    }
    allergenDrag = null;
  });
  document.addEventListener("pointercancel", function () { allergenDrag = null; });

  function allergenChips(codes) {
    var wrap = el("div", "allergens");
    wrap.appendChild(el("span", "sr", TEXT.allergensPrefix));
    var seen = {};
    var list = codes
      .map(function (c) { return String(c).trim().toUpperCase(); })
      .filter(function (c) { if (!c || seen[c]) return false; seen[c] = true; return true; });

    // Reihenfolge wie in allergens.json (also wie auf dem Aushang); unbekannte Codes ans Ende
    function rank(c) { return state.allergenByCode[c] ? state.allergenByCode[c].order : 1000 + c.charCodeAt(0); }
    list.sort(function (a, b) { return rank(a) - rank(b); });

    list.forEach(function (code) { wrap.appendChild(makeChip(code, true)); });
    return wrap;
  }

  // Touch: Antippen zeigt den Namen. Maus und Tastatur nutzen Hover/Fokus.
  document.addEventListener("click", function (e) {
    var chip = e.target.closest ? e.target.closest(".al-foldable") : null;
    if (chip && canHover()) return;
    if (!chip) { closeOpenChip(); return; }
    if (chip === openChip) { closeOpenChip(); return; }
    closeOpenChip();
    chip.classList.add("is-open");
    chip.setAttribute("aria-expanded", "true");
    openChip = chip;
    positionAllergenName(chip);
  });

  document.addEventListener("mouseover", function (e) {
    if (!canHover() || !e.target.closest) return;
    var chip = e.target.closest(".al-foldable");
    if (!chip) return;
    chip.setAttribute("aria-expanded", "true");
    positionAllergenName(chip);
  });

  document.addEventListener("focusin", function (e) {
    var chip = e.target.closest ? e.target.closest(".al-foldable") : null;
    if (!chip) return;
    chip.setAttribute("aria-expanded", "true");
    positionAllergenName(chip);
  });

  document.addEventListener("mouseout", function (e) {
    if (!canHover() || !e.target.closest) return;
    var chip = e.target.closest(".al-foldable");
    if (chip && !chip.contains(e.relatedTarget)) chip.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("focusout", function (e) {
    var chip = e.target.closest ? e.target.closest(".al-foldable") : null;
    if (chip && !chip.contains(e.relatedTarget)) chip.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeOpenChip();
  });

  /* ---------- Foto/Beschreibung: Vorschau beim Überfahren mit der Maus ---------- */
  var hoverBox = null;
  var hoverTimer = null;

  function ensureHoverBox() {
    if (hoverBox) return hoverBox;
    hoverBox = el("div", "hover-preview");
    hoverBox.appendChild(el("img"));
    hoverBox.hidden = true;
    document.body.appendChild(hoverBox);
    return hoverBox;
  }

  function positionHoverBox(trigger) {
    var box = ensureHoverBox();
    var r = trigger.getBoundingClientRect();
    var left = r.left + window.scrollX;
    var maxLeft = window.scrollX + document.documentElement.clientWidth - 176;   // Vorschau bleibt im Bild
    if (left > maxLeft) left = Math.max(window.scrollX + 8, maxLeft);
    box.style.left = left + "px";
    box.style.top = (r.top + window.scrollY) + "px";
  }

  function showHoverBox(trigger, src) {
    var box = ensureHoverBox();
    box.querySelector("img").src = src;
    positionHoverBox(trigger);
    box.hidden = false;
    void box.offsetWidth;   // Reflow erzwingen, damit die folgende Klasse den Übergang auslöst
    box.classList.add("is-visible");
  }

  function hideHoverBox() {
    if (!hoverBox) return;
    hoverBox.classList.remove("is-visible");
  }

  function attachHoverPreview(trigger, image) {
    if (!image || !canHover()) return;   // nur auf Geräten mit Maus, und nur wenn ein Foto vorhanden ist
    trigger.addEventListener("mouseenter", function () {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { showHoverBox(trigger, image); }, 120);
    });
    trigger.addEventListener("mouseleave", function () {
      clearTimeout(hoverTimer);
      hideHoverBox();
    });
    trigger.addEventListener("blur", hideHoverBox);
  }

  /* ---------- Foto groß: Bild antippen/anklicken füllt die Bildschirmmitte, nochmal antippen schließt es ---------- */
  var lightbox = null;
  var lightboxTrigger = null;

  function ensureLightbox() {
    if (lightbox) return lightbox;
    var overlay = el("div", "lightbox-overlay");
    overlay.hidden = true;
    overlay.tabIndex = -1;
    var img = el("img", "lightbox-img");
    img.alt = "";
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", closeLightbox);
    lightbox = { overlay: overlay, img: img, closeTimer: null };
    return lightbox;
  }

  function openLightbox(src, triggerEl) {
    var lb = ensureLightbox();
    clearTimeout(lb.closeTimer);
    lb.img.src = src;
    lightboxTrigger = triggerEl || null;
    lb.overlay.hidden = false;
    void lb.overlay.offsetWidth;
    lb.overlay.classList.add("is-visible");
    document.addEventListener("keydown", onLightboxKeydown);
    lb.overlay.focus();
  }

  function closeLightbox() {
    var lb = lightbox;
    if (!lb || lb.overlay.hidden) return;
    lb.overlay.classList.remove("is-visible");
    document.removeEventListener("keydown", onLightboxKeydown);
    var wait = reduceMotion() ? 0 : 200;
    lb.closeTimer = setTimeout(function () { lb.overlay.hidden = true; }, wait);
    if (lightboxTrigger) { lightboxTrigger.focus(); lightboxTrigger = null; }
  }

  function onLightboxKeydown(e) {
    if (e.key === "Escape") { closeLightbox(); return; }
    if (e.key === "Tab") { e.preventDefault(); lightbox.overlay.focus(); }
  }

  function isLightboxOpen() { return !!(lightbox && !lightbox.overlay.hidden); }

  function schoolYearStart(today) {
    var year = today.getFullYear() - (today.getMonth() < 8 ? 1 : 0);
    return new Date(year, 8, 1);
  }

  function dateKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function normalizedDishName(name) { return String(name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("de"); }

  function dishOccurrences(name) {
    var target = normalizedDishName(name);
    var occurrences = [];
    var now = new Date();
    var schoolStart = schoolYearStart(now);
    var schoolEnd = new Date(schoolStart.getFullYear() + 1, 7, 31);
    state.historyFiles.forEach(function (file) {
      var data = state.weekData[file];
      if (!data || !Array.isArray(data.days)) return;
      var monday = mondayOf(dateFromFile(file));
      data.days.forEach(function (day) {
        if (!day || typeof day !== "object") return;
        var dayIndex = DAY_NAMES.indexOf(String(day.day || "").trim().toLowerCase());
        if (dayIndex < 0) return;
        var date = addDays(monday, dayIndex);
        if (date < schoolStart || date > schoolEnd) return;
        var meals = {};
        MEALS.forEach(function (meal) { meals[meal.key] = Array.isArray(day[meal.key]) ? day[meal.key] : []; });
        MEALS.forEach(function (meal) {
          var items = meals[meal.key];
          var mainIndex = items.length >= 2 ? items.length - 2 : (items.length === 1 ? 0 : -1);
          if (mainIndex < 0 || !items[mainIndex] || normalizedDishName(items[mainIndex].name) !== target) return;
          var time = mealTimeFor(day, meal.key);
          var endedAt = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          endedAt.setMinutes(parseHM(time.end), 0, 0);
          occurrences.push({
            file: file,
            date: date,
            dateKey: dateKey(date),
            dayName: String(day.day).trim(),
            mealKey: meal.key,
            mealLabel: meal.label,
            endedAt: endedAt,
            happened: endedAt <= now
          });
        });
      });
    });
    occurrences.sort(function (a, b) {
      if (a.date - b.date) return a.date - b.date;
      if (a.mealKey === b.mealKey) return 0;
      return a.mealKey === "lunch" ? -1 : 1;
    });
    return occurrences;
  }

  function navigateToOccurrence(occurrences, occurrence) {
    // Navigate to the exact history entry the user selected.
    var destination = occurrence;
    var origin = state.detailContext || {
      week: stem(occurrence.file), date: occurrence.dateKey,
      mealKey: occurrence.mealKey, name: ""
    };
    state.historyReturn = { origin: origin, name: origin.name };
    state.pendingNavigation = {
      week: stem(destination.file),
      date: destination.dateKey,
      mealKey: destination.mealKey,
      historyHighlight: true
    };
    renderActiveAllergens();
    closeDetail();
    if (location.hash.replace(/^#/, "") === state.pendingNavigation.week) route();
    else location.hash = state.pendingNavigation.week;
  }

  function returnToHistoryMenu() {
    if (!state.historyReturn) return;
    var origin = state.historyReturn.origin;
    state.pendingNavigation = {
      week: origin.week,
      date: origin.date,
      mealKey: origin.mealKey,
      restoreMenu: true
    };
    if (location.hash.replace(/^#/, "") === origin.week) route();
    else location.hash = origin.week;
  }

  function clearHistoryReturn() {
    if (!state.historyReturn) return;
    state.historyReturn = null;
    renderActiveAllergens();
  }

  function renderDishHistory(name, dialog) {
    var occurrences = dishOccurrences(name);
    var context = state.detailContext;
    if (context && context.name === name && !occurrences.some(function (item) {
      return item.dateKey === context.date && item.mealKey === context.mealKey;
    })) {
      var date = new Date(context.date + "T12:00:00");
      var contextDate = dateFromFile(context.date);
      var file = context.week + ".json";
      var week = state.weekData[file];
      var dayIndex = Math.round((contextDate - mondayOf(contextDate)) / 86400000);
      var day = week && Array.isArray(week.days) ? week.days.find(function (entry) {
        return String(entry.day || "").trim().toLowerCase() === DAY_NAMES[dayIndex];
      }) : null;
      var meal = MEALS.find(function (entry) { return entry.key === context.mealKey; });
      if (day && meal) {
        var endedAt = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        endedAt.setMinutes(parseHM(mealTimeFor(day, meal.key).end), 0, 0);
        occurrences.push({ file: file, date: date, dateKey: context.date, dayName: String(day.day).trim(), mealKey: meal.key, mealLabel: meal.label, endedAt: endedAt, happened: endedAt <= new Date() });
      }
    }
    var past = occurrences.filter(function (item) { return item.happened; });
    dialog.historySummary.textContent = past.length
      ? occurrences.length + "× · zuletzt am " + formatShort(past[past.length - 1].date)
      : occurrences.length
        ? occurrences.length + "× · als Nächstes am " + formatShort(occurrences[0].date)
        : "Dieser Termin steht im aktuellen Menü.";
    dialog.historyList.textContent = "";
    if (!occurrences.length) return;
    var byDate = {};
    occurrences.slice().reverse().forEach(function (occurrence) {
      if (!byDate[occurrence.dateKey]) byDate[occurrence.dateKey] = { date: occurrence.date, dayName: occurrence.dayName, meals: [] };
      byDate[occurrence.dateKey].meals.push(occurrence);
    });
    Object.keys(byDate).forEach(function (dateKey) {
      var group = byDate[dateKey];
      group.meals.sort(function (a, b) {
        return (a.mealKey === "lunch" ? 0 : 1) - (b.mealKey === "lunch" ? 0 : 1);
      });
      var li = el("li");
      group.meals.forEach(function (occurrence) {
        var button = el("button", "history-date-entry");
        button.type = "button";
        var mealName = occurrence.mealKey === "lunch" ? "Mittag" : "Abend";
        button.title = occurrence.dayName + ", " + formatDate(occurrence.date) + " · " + mealName + ". Zum Termin springen.";
        button.setAttribute("aria-label", button.title);
        button.appendChild(el("span", "history-day", group.dayName.slice(0, 2)));
        button.appendChild(el("span", "history-date", formatShort(group.date)));
        button.appendChild(el("span", "history-meal-label", mealName));
        button.addEventListener("click", function () { navigateToOccurrence(occurrences, occurrence); });
        li.appendChild(button);
      });
      dialog.historyList.appendChild(li);
    });
  }

  /* ---------- Sitzplan beim gemeinsamen Essen ---------- */
  var seatingDialog = null;

  function renderSeatingPlan(query, sortMode, planDate) {
    if (!seatingDialog) return;
    var source = state.seatingPlans && state.seatingPlans[planDate];
    var people = Array.isArray(source) ? source.slice() : [];
    var needle = String(query || "").trim().toLocaleLowerCase("de");
    var filtered = people.filter(function (person) {
      return (person.vorname + " " + person.nachname + " " + person.platz)
        .toLocaleLowerCase("de").indexOf(needle) >= 0;
    });
    filtered.sort(sortMode === "number"
      ? function (a, b) { return a.platz - b.platz || a.nachname.localeCompare(b.nachname, "de"); }
      : function (a, b) { return a.nachname.localeCompare(b.nachname, "de") || a.vorname.localeCompare(b.vorname, "de") || a.platz - b.platz; });

    seatingDialog.chart.textContent = "";
    if (!people.length) {
      seatingDialog.empty.hidden = false;
      seatingDialog.content.hidden = true;
      return;
    }
    seatingDialog.empty.hidden = true;
    seatingDialog.content.hidden = false;
    var byPlace = {};
    var matchingPlaces = {};
    people.forEach(function (person) { byPlace[person.platz] = person; });
    filtered.forEach(function (person) {
      if (needle) matchingPlaces[person.platz] = true;
    });
    var layout = el("div", "seatplan-layout");
    var tables = el("div", "seatplan-tables");
    [3, 2, 1, 6, 5, 4, 9, 8, 7, 12, 11, 10, 13, 14].forEach(function (tableNumber) {
      var table = el("section", "seatplan-table");
      table.setAttribute("aria-label", "Tisch " + tableNumber);
      var topRow = el("div", "seatplan-seat-row");
      var bottomRow = el("div", "seatplan-seat-row");
      var firstSeat = (tableNumber - 1) * 10 + 1;
      var topSeats = [firstSeat + 4, firstSeat + 3, firstSeat + 2, firstSeat + 1, firstSeat];
      var bottomSeats = [firstSeat + 5, firstSeat + 6, firstSeat + 7, firstSeat + 8, firstSeat + 9];
      function addSeat(row, seatNumber) {
        var person = byPlace[seatNumber];
        var seat = el(person ? "button" : "span", "seatplan-seat" + (person ? "" : " is-empty") + (matchingPlaces[seatNumber] ? " is-match" : ""), String(seatNumber));
        if (person) {
          seat.type = "button";
          seat.title = person.vorname + " " + person.nachname + " suchen";
          seat.addEventListener("click", function () {
            seatingDialog.search.value = person.vorname + " " + person.nachname;
            renderSeatingPlan(seatingDialog.search.value, seatingDialog.sort.value, seatingDialog.date);
          });
        }
        seat.setAttribute("aria-label", person
          ? "Platz " + seatNumber + ": " + person.vorname + " " + person.nachname
          : "Platz " + seatNumber + " frei");
        row.appendChild(seat);
      }
      topSeats.forEach(function (seatNumber) { addSeat(topRow, seatNumber); });
      bottomSeats.forEach(function (seatNumber) { addSeat(bottomRow, seatNumber); });
      table.appendChild(topRow);
      table.appendChild(el("div", "seatplan-table-label", "Tisch " + tableNumber));
      table.appendChild(bottomRow);
      tables.appendChild(table);
    });
    var entrance = el("aside", "seatplan-entrance");
    entrance.setAttribute("aria-label", "Eingang Speisesaal");
    entrance.appendChild(el("div", "seatplan-door", "← Eingang Speisesaal"));
    entrance.appendChild(el("div", "seatplan-door", "← Eingang Speisesaal"));
    layout.appendChild(tables);
    layout.appendChild(entrance);
    seatingDialog.chart.appendChild(layout);

    seatingDialog.list.textContent = "";
    if (!filtered.length) {
      seatingDialog.list.appendChild(el("li", "seatplan-no-results", "Keine passenden Personen gefunden."));
      return;
    }
    filtered.forEach(function (person) {
      var tableNumber = Math.ceil(person.platz / 10);
      var row = el("li", "seatplan-person");
      row.appendChild(el("span", "seatplan-person-name", person.vorname + " " + person.nachname));
      row.appendChild(el("span", "seatplan-person-meta", "Platz " + person.platz + " · Tisch " + tableNumber));
      seatingDialog.list.appendChild(row);
    });
  }

  function openSeatingPlan(planDate) {
    if (!seatingDialog) {
      var overlay = el("div", "detail-overlay seating-overlay");
      overlay.hidden = true;
      var dialog = el("div", "detail-dialog seatplan-dialog");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "seatplan-title");
      dialog.tabIndex = -1;
      var close = el("button", "detail-close", "✕");
      close.type = "button";
      close.setAttribute("aria-label", TEXT.detailClose);
      close.addEventListener("click", closeSeatingPlan);
      var title = el("h3", "detail-title", "Sitzplan – gemeinsames Abendessen");
      title.id = "seatplan-title";
      var empty = el("p", "seatplan-empty", "Für dieses gemeinsame Essen gibt es noch keinen Sitzplan.");
      var content = el("div", "seatplan-content");
      var chartTitle = el("h4", "seatplan-section-title seatplan-chart-title", "Tischplan");
      var chart = el("div", "seatplan-chart");
      var peopleTitle = el("h4", "seatplan-section-title seatplan-people-title", "Personen");
      var controls = el("div", "seatplan-controls");
      var search = el("input", "seatplan-search");
      search.type = "search";
      search.placeholder = "Name oder Platznummer suchen";
      search.setAttribute("aria-label", "Personen nach Name oder Platznummer durchsuchen");
      var sort = el("select", "seatplan-sort");
      sort.setAttribute("aria-label", "Personen sortieren");
      var nameOption = el("option", "", "Nach Name");
      nameOption.value = "name";
      var numberOption = el("option", "", "Nach Nummer");
      numberOption.value = "number";
      sort.appendChild(nameOption);
      sort.appendChild(numberOption);
      controls.appendChild(search);
      controls.appendChild(sort);
      var list = el("ul", "seatplan-people");
      search.addEventListener("input", function () { renderSeatingPlan(search.value, sort.value, seatingDialog.date); });
      sort.addEventListener("change", function () { renderSeatingPlan(search.value, sort.value, seatingDialog.date); });
      content.appendChild(chartTitle);
      content.appendChild(chart);
      content.appendChild(peopleTitle);
      content.appendChild(controls);
      content.appendChild(list);
      dialog.appendChild(close);
      dialog.appendChild(title);
      dialog.appendChild(empty);
      dialog.appendChild(content);
      overlay.appendChild(dialog);
      overlay.addEventListener("click", function (event) { if (event.target === overlay) closeSeatingPlan(); });
      document.body.appendChild(overlay);
      seatingDialog = { overlay: overlay, dialog: dialog, close: close, empty: empty, content: content, chart: chart, list: list, search: search, sort: sort, date: null };
    }
    if (seatingDialog.date !== planDate) seatingDialog.search.value = "";
    seatingDialog.date = planDate || null;
    var hasFile = !!(seatingDialog.date && state.seatingFiles[seatingDialog.date]);
    if (hasFile && !Object.prototype.hasOwnProperty.call(state.seatingPlans, seatingDialog.date)) {
      seatingDialog.empty.textContent = "Sitzplan wird geladen …";
      seatingDialog.empty.hidden = false;
      seatingDialog.content.hidden = true;
      fetchSeatingPlan(seatingDialog.date).then(function () {
        if (seatingDialog && seatingDialog.date === planDate && !seatingDialog.overlay.hidden) {
          seatingDialog.empty.textContent = "Für dieses gemeinsame Essen gibt es noch keinen Sitzplan.";
          renderSeatingPlan(seatingDialog.search.value, seatingDialog.sort.value, seatingDialog.date);
        }
      });
    } else {
      seatingDialog.empty.textContent = "Für dieses gemeinsame Essen gibt es noch keinen Sitzplan.";
      renderSeatingPlan(seatingDialog.search.value, seatingDialog.sort.value, seatingDialog.date);
    }
    seatingDialog.overlay.hidden = false;
    document.body.classList.add("detail-open");
    void seatingDialog.overlay.offsetWidth;
    seatingDialog.overlay.classList.add("is-visible");
    seatingDialog.dialog.focus();
    document.addEventListener("keydown", onSeatingPlanKeydown);
  }

  function onSeatingPlanKeydown(event) {
    if (!seatingDialog || seatingDialog.overlay.hidden) return;
    if (event.key === "Escape") { closeSeatingPlan(); return; }
    if (event.key !== "Tab") return;
    var focusables = [seatingDialog.close, seatingDialog.search, seatingDialog.sort].filter(function (node) {
      return node && !node.disabled && node.getClientRects().length > 0;
    });
    if (!focusables.length) return;
    var index = focusables.indexOf(document.activeElement);
    var next = event.shiftKey
      ? (index <= 0 ? focusables.length - 1 : index - 1)
      : (index < 0 || index === focusables.length - 1 ? 0 : index + 1);
    event.preventDefault();
    focusables[next].focus();
  }

  function closeSeatingPlan() {
    if (!seatingDialog || seatingDialog.overlay.hidden) return;
    seatingDialog.overlay.classList.remove("is-visible");
    document.body.classList.remove("detail-open");
    document.removeEventListener("keydown", onSeatingPlanKeydown);
    window.setTimeout(function () { if (seatingDialog) seatingDialog.overlay.hidden = true; }, reduceMotion() ? 0 : 220);
  }

  /* ---------- Foto/Beschreibung: Dialog beim Anklicken ---------- */
  var detail = null;
  var detailTrigger = null;

  function ensureDetail() {
    if (detail) return detail;

    var overlay = el("div", "detail-overlay");
    overlay.hidden = true;

    var dialog = el("div", "detail-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "detail-title");
    dialog.tabIndex = -1;
    dialog.addEventListener("click", function (e) {
      var target = e.target.nodeType === 1 ? e.target : e.target.parentElement;
      if (canHover() || !target || target.closest("button, a, input, select, textarea, [role='button'], .detail-media, img")) return;
      var selection = window.getSelection ? window.getSelection() : null;
      if (selection && !selection.isCollapsed && selection.toString().trim()) return;
      closeDetail();
    });

    var closeBtn = el("button", "detail-close", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", TEXT.detailClose);
    closeBtn.addEventListener("click", closeDetail);

    var title = el("h3", "detail-title");
    title.id = "detail-title";

    var content = el("div", "detail-content");
    var media = el("div", "detail-media");
    var img = el("img");
    img.loading = "lazy";
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.title = TEXT.zoomHint;
    img.addEventListener("click", function (e) { e.stopPropagation(); openLightbox(img.src, img); });
    img.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(img.src, img); }
    });
    media.appendChild(img);

    var body = el("div", "detail-body");
    var desc = el("p", "detail-description");
    var link = el("a", "detail-link", "↗");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.hidden = true;
    var allergenWrap = el("div", "detail-allergens");
    var history = el("section", "detail-history");
    history.setAttribute("aria-labelledby", "detail-history-title");
    var historyTitle = el("h4", "", "Dieses Schuljahr im Speiseplan");
    historyTitle.id = "detail-history-title";
    var historySummary = el("p", "detail-history-summary");
    var historyList = el("ul", "detail-history-list");
    history.appendChild(historyTitle);
    history.appendChild(historySummary);
    history.appendChild(historyList);

    body.appendChild(allergenWrap);
    body.appendChild(media);
    body.appendChild(desc);
    body.appendChild(link);
    content.appendChild(body);

    dialog.appendChild(closeBtn);
    dialog.appendChild(title);
    dialog.appendChild(content);
    dialog.appendChild(history);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeDetail(); });

    detail = { overlay: overlay, dialog: dialog, closeBtn: closeBtn, title: title, media: media, img: img, desc: desc, link: link, allergenWrap: allergenWrap, history: history, historySummary: historySummary, historyList: historyList, closeTimer: null };
    return detail;
  }

  function onDetailKeydown(e) {
    if (isLightboxOpen()) return;   // die Lightbox hat ihren eigenen Escape/Tab-Handler
    if (e.key === "Escape" && !canHover()) { closeDetail(); return; }
    if (e.key === "Tab") {
      // Alle sichtbaren Ziele im Dialog (einschließlich der Historienlinks) aufnehmen.
      var focusables = Array.prototype.filter.call(detail.dialog.querySelectorAll("button, a[href], [tabindex='0']"), function (node) {
        return !node.disabled && !node.hidden && node.getAttribute("aria-hidden") !== "true" && node.getClientRects().length > 0;
      });
      if (!focusables.length) focusables = [detail.closeBtn];
      var index = focusables.indexOf(document.activeElement);
      var next = e.shiftKey
        ? (index <= 0 ? focusables.length - 1 : index - 1)
        : (index < 0 || index === focusables.length - 1 ? 0 : index + 1);
      e.preventDefault();
      focusables[next].focus();
    }
  }

  function openDetail(name, info, allergens, triggerEl, context) {
    hideHoverBox();
    var d = ensureDetail();
    clearTimeout(d.closeTimer);
    clearHistoryReturn();
    state.detailContext = context || null;

    d.title.textContent = name;

    info = info || {};
    if (info.image) {
      d.img.onerror = function () { d.media.hidden = true; };
      d.img.src = info.image;
      d.img.alt = "";
      d.media.hidden = false;
    } else {
      d.media.hidden = true;
    }

    d.desc.textContent = info.description || "";
    d.desc.hidden = !info.description;
    d.link.hidden = !info.link;
    if (info.link) {
      d.link.href = info.link;
      var host = new URL(info.link, window.location.href).host;
      d.link.textContent = host;
      d.link.title = info.link;
      d.link.setAttribute("aria-label", TEXT.linkHint + ": " + host);
    }

    renderDishHistory(name, d);

    d.allergenWrap.textContent = "";
    if (allergens && allergens.length) {
      d.allergenWrap.appendChild(allergenChips(allergens));
      d.allergenWrap.hidden = false;
    } else {
      d.allergenWrap.hidden = true;
    }
    applyAllergenHighlights();

    detailTrigger = triggerEl || null;
    document.body.classList.add("detail-open");
    d.overlay.hidden = false;
    void d.overlay.offsetWidth;   // Reflow erzwingen, damit die Klasse unten einen Übergang auslöst statt sofort umzuspringen
    d.overlay.classList.add("is-visible");
    document.addEventListener("keydown", onDetailKeydown);
    d.dialog.focus();
  }

  function closeDetail() {
    closeLightbox();
    var d = detail;
    if (!d || d.overlay.hidden) return;
    clearTimeout(d.closeTimer);
    d.overlay.classList.remove("is-visible");
    document.body.classList.remove("detail-open");
    document.removeEventListener("keydown", onDetailKeydown);
    var wait = reduceMotion() ? 0 : 220;
    d.closeTimer = setTimeout(function () { d.overlay.hidden = true; }, wait);
    if (detailTrigger) { detailTrigger.focus(); detailTrigger = null; }
  }

  /* ---------- Ein Gericht (mit oder ohne Foto/Beschreibung) ---------- */
  function renderDish(item, isMain, day, meal, monday) {
    var name = item.name;
    var info = isMain ? (state.dishes[name.trim()] || {}) : null;
    var cls = "dish" + (isMain ? " dish-main" : "");

    if (!isMain) return el("div", cls, name);

    var trigger = el("button", cls + " dish-detail", name);
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.title = info.description || info.image || info.link
      ? TEXT.detailHint + " und Schuljahres-Historie ansehen"
      : "Schuljahres-Historie ansehen";

    var allergens = Array.isArray(item.allergens) ? item.allergens : [];
    var dayIndex = DAY_NAMES.indexOf(String(day.day || "").trim().toLowerCase());
    var context = {
      week: dateKey(monday),
      date: dateKey(addDays(monday, Math.max(0, dayIndex))),
      mealKey: meal.key,
      name: name
    };
    trigger.addEventListener("click", function () { openDetail(name, info, allergens, trigger, context); });
    attachHoverPreview(trigger, info.image);

    return trigger;
  }

  function renderMeal(day, meal, isNext, monday) {
    var items = Array.isArray(day[meal.key]) ? day[meal.key].slice() : [];
    var sharedDinner = null;
    if (meal.key === "dinner") {
      var explicitSharedDinner = day.sharedDinner && typeof day.sharedDinner === "object" ? day.sharedDinner : null;
      var announcementIndex = items.findIndex(function (item) {
        return item && typeof item.name === "string" && /^Gemeinsames Abendessen\b/i.test(item.name.trim());
      });
      var afterIndex = items.findIndex(function (item) {
        return item && typeof item.name === "string" && /^Anschließend\b/i.test(item.name.trim());
      });
      if (explicitSharedDinner || announcementIndex >= 0) {
        var announcement = announcementIndex >= 0 ? items[announcementIndex] : null;
        var detectedTitle = announcement ? announcement.name
          .replace(/\s*\([^)]*Sitzplatzreservierung[^)]*\)\s*/i, " ")
          .replace(/\bum\s+(\d{1,2})[.:](\d{2})\s+Uhr\b/i, "· $1:$2 Uhr")
          .trim() : "Gemeinsames Abendessen";
        sharedDinner = {
          title: explicitSharedDinner && explicitSharedDinner.title || detectedTitle,
          reservationNote: explicitSharedDinner && explicitSharedDinner.reservationNote || "Bitte den Sitzplatz frühzeitig reservieren.",
          note: explicitSharedDinner && explicitSharedDinner.note || (afterIndex >= 0 ? items[afterIndex].name : "")
        };
        items = items.filter(function (_, index) { return index !== announcementIndex && index !== afterIndex; });
      }
    }

    if (!items.length && !sharedDinner) return null;   // leere Mahlzeit (z. B. Freitagabend): gar nichts anzeigen

    // Das Hauptgericht ist immer das vorletzte Gericht der Mahlzeit (danach kommt nur noch der Nachtisch/Obst).
    var mainIndex = items.length >= 2 ? items.length - 2 : (items.length === 1 ? 0 : -1);

    var cell = el("div", "meal meal-" + meal.key + (isNext ? " is-next" : ""));
    var sharedTime = "18:30";
    if (sharedDinner) {
      var rawSharedTitle = sharedDinner.title || "Gemeinsames Abendessen";
      var timeMatch = String(sharedDinner.time || rawSharedTitle).match(/(\d{1,2})[.:](\d{2})/);
      if (timeMatch) sharedTime = pad(Number(timeMatch[1])) + ":" + timeMatch[2];
      var sharedTitle = rawSharedTitle
        .replace(/\s*[·–-]\s*\d{1,2}[.:]\d{2}(?:\s*Uhr)?\s*$/i, "")
        .replace(/\s+um\s+\d{1,2}[.:]\d{2}\s*(?:Uhr)?\s*$/i, "")
        .trim();

      cell.classList.add("is-shared");
      var shared = el("div", "shared-meal-banner");
      var heading = el("div", "shared-meal-heading");
      heading.appendChild(el("strong", "shared-meal-title", sharedTitle));
      shared.appendChild(heading);
      shared.appendChild(el("div", "shared-meal-time", sharedTime));
      cell.appendChild(shared);
    }
    var label = el("h3", "meal-label");
    label.appendChild(document.createTextNode(meal.label + " "));
    label.appendChild(el("span", "meal-time", sharedDinner ? sharedTime : formatRange(mealTimeFor(day, meal.key))));
    cell.appendChild(label);

    var list = el("ul", "dishes");
    items.forEach(function (item, idx) {
      if (!item || typeof item.name !== "string") return;
      var isMain = idx === mainIndex;
      var li = el("li", isMain ? "is-main" : "");
      li.appendChild(renderDish(item, isMain, day, meal, monday));
      if (Array.isArray(item.allergens) && item.allergens.length) {
        li.appendChild(allergenChips(item.allergens));
      }
      list.appendChild(li);
    });
    cell.appendChild(list);
    if (sharedDinner && sharedDinner.note) {
      var note = el("p", "shared-meal-note");
      var colonAt = String(sharedDinner.note).indexOf(":");
      if (colonAt >= 0) {
        note.appendChild(document.createTextNode(String(sharedDinner.note).slice(0, colonAt + 1)));
        note.appendChild(el("br"));
        note.appendChild(document.createTextNode(String(sharedDinner.note).slice(colonAt + 1).trim()));
      } else {
        note.textContent = sharedDinner.note;
      }
      cell.appendChild(note);
    }
    if (sharedDinner) {
      var seatPlanLink = el("button", "shared-meal-seatplan", sharedDinner.reservationNote || "Bitte den Sitzplatz frühzeitig reservieren.");
      seatPlanLink.type = "button";
      seatPlanLink.setAttribute("aria-haspopup", "dialog");
      var dayIndexForPlan = DAY_NAMES.indexOf(String(day.day || "").trim().toLowerCase());
      var sharedMealDate = dayIndexForPlan >= 0 ? dateKey(addDays(monday, dayIndexForPlan)) : null;
      seatPlanLink.addEventListener("click", function () { openSeatingPlan(sharedMealDate); });
      cell.appendChild(seatPlanLink);
    }

    return cell;
  }

  function renderDay(day, monday, today, nextMeal) {
    var name = String(day.day || "").trim();
    var idx = DAY_NAMES.indexOf(name.toLowerCase());
    var date = idx >= 0 ? addDays(monday, idx) : null;
    var isToday = !!date && sameDay(date, today);

    var section = el("section", "day" + (isToday ? " is-today" : ""));
    if (date) section.dataset.dayDate = dateKey(date);
    if (isToday) section.setAttribute("aria-current", "date");

    var head = el("div", "day-head");
    var title = el("div", "day-title");
    title.appendChild(el("h2", "day-name", name));
    if (date) title.appendChild(el("span", "day-date", formatShort(date)));
    if (name.toLowerCase() === "freitag") title.appendChild(el("span", "day-extra", "13:00–13:30"));
    head.appendChild(title);
    if (isToday) head.appendChild(el("span", "today-tag", TEXT.today));
    section.appendChild(head);

    var next = nextMeal && nextMeal.dayIndex === idx ? nextMeal.key : null;
    MEALS.forEach(function (meal) {
      var cell = renderMeal(day, meal, meal.key === next, monday);
      if (cell) section.appendChild(cell);
    });
    return section;
  }

  function renderWeek(file, data) {
    var monday = mondayOf(dateFromFile(file));
    var today = new Date();
    var weekLabel = typeof data.week === "string" && data.week.trim()
      ? data.week.trim().replace(/\s+-\s+/, " – ")
      : formatShort(monday) + " – " + formatShort(addDays(monday, 4));

    ui.label.textContent = weekLabel;
    ui.meta.textContent = TEXT.calendarWeek + " " + isoWeek(monday);
    document.title = "Speiseplan " + weekLabel;

    ui.plan.textContent = "";
    var days = Array.isArray(data.days) ? data.days : [];
    if (!days.length) {
      showMessage(TEXT.noEntries);
      return;
    }
    var nextMeal = nextMealTarget(days, monday, today);
    days.forEach(function (day) {
      if (day && typeof day === "object") ui.plan.appendChild(renderDay(day, monday, today, nextMeal));
    });
    applyAllergenHighlights();
  }

  // Kurzes Überblenden beim Wechsel der Woche. Wird beim allerersten Aufbau
  // und bei "Bewegung reduzieren" übersprungen.
  function renderWeekAnimated(file, data, animate, onDone) {
    if (!animate || !ui.panel || reduceMotion()) {
      renderWeek(file, data);
      if (onDone) onDone();
      return;
    }
    ui.panel.classList.add("is-changing");
    if (ui.mastheadText) ui.mastheadText.classList.add("is-changing");
    setTimeout(function () {
      renderWeek(file, data);
      requestAnimationFrame(function () {
        ui.panel.classList.remove("is-changing");
        if (ui.mastheadText) ui.mastheadText.classList.remove("is-changing");
        if (onDone) onDone();
      });
    }, 160);
  }

  function renderControls(currentFile) {
    var i = state.files.indexOf(currentFile);
    var several = state.files.length > 1;

    ui.select.textContent = "";
    state.files.forEach(function (file) {
      var monday = mondayOf(dateFromFile(file));
      var label = TEXT.weekOption
        .replace("{kw}", isoWeek(monday))
        .replace("{date}", formatDate(monday));
      var opt = el("option", "", label);
      opt.value = stem(file);
      if (file === currentFile) opt.selected = true;
      ui.select.appendChild(opt);
    });

    // Nur eine Woche: Dropdown ohne Pfeil, keine Buttons.
    ui.select.disabled = !several;
    ui.select.classList.toggle("is-single", !several);
    ui.prev.hidden = !several;
    ui.next.hidden = !several;

    // Mehrere Wochen: Buttons behalten ihren Platz und werden nur unsichtbar,
    // damit das Dropdown in der Mitte nie verrutscht.
    var hasOlder = i >= 0 && i < state.files.length - 1;   // ältere Woche = weiter hinten in der Liste
    var hasNewer = i > 0;                                  // neuere Woche = weiter vorne
    ui.prev.classList.toggle("is-off", !hasOlder);
    ui.next.classList.toggle("is-off", !hasNewer);
    ui.prev.dataset.target = hasOlder ? stem(state.files[i + 1]) : "";
    ui.next.dataset.target = hasNewer ? stem(state.files[i - 1]) : "";
  }

  function loadSchoolYearHistory() {
    var start = schoolYearStart(new Date());
    var end = new Date(start.getFullYear() + 1, 7, 31);
    state.historyFiles = state.files.filter(function (file) {
      var monday = mondayOf(dateFromFile(file));
      return addDays(monday, 4) >= start && monday <= end;
    });
    return Promise.all(state.historyFiles.map(function (file) {
      return fetchJSON("weeks/" + file).then(function (data) {
        state.weekData[file] = data;
      }).catch(function () { state.weekData[file] = null; });
    }));
  }

  function renderLegend() {
    ui.legend.textContent = "";
    state.allergens.forEach(function (a) {
      var li = el("li");
      var toggle = el("button", "legend-filter al-filter");
      toggle.type = "button";
      toggle.setAttribute("data-code", a.code);
      toggle.setAttribute("aria-pressed", state.selectedAllergens[a.code] ? "true" : "false");
      toggle.setAttribute("aria-label", "Allergen " + a.code + ": " + a.name + " umschalten");
      toggle.title = "Passende Gerichte hervorheben: " + a.name;
      toggle.appendChild(makeChip(a.code, false, false));
      toggle.appendChild(el("span", "legend-allergen-name", a.name));
      toggle.addEventListener("click", function () {
        if (suppressAllergenClick) { suppressAllergenClick = false; return; }
        toggleAllergen(a.code);
      });
      li.appendChild(toggle);
      ui.legend.appendChild(li);
    });
    applyAllergenHighlights();
  }

  function applyAllergenHighlights() {
    var selected = Object.keys(state.selectedAllergens);
    document.body.classList.toggle("has-allergen-filter", selected.length > 0);

    document.querySelectorAll(".al[data-code]").forEach(function (chip) {
      var active = selected.indexOf(chip.getAttribute("data-code")) >= 0;
      chip.classList.toggle("is-selected", active);
      chip.classList.toggle("is-muted", selected.length > 0 && !active);
    });
    document.querySelectorAll(".al-filter[data-code]").forEach(function (filter) {
      filter.setAttribute("aria-pressed", selected.indexOf(filter.getAttribute("data-code")) >= 0 ? "true" : "false");
    });

    document.querySelectorAll(".dishes li").forEach(function (item) {
      var matches = Array.prototype.some.call(item.querySelectorAll(".allergens .al[data-code]"), function (chip) {
        return selected.indexOf(chip.getAttribute("data-code")) >= 0;
      });
      item.classList.toggle("has-allergen-match", matches);
    });
    renderActiveAllergens();
  }

  function renderActiveAllergens() {
    if (!ui.activeAllergens) return;
    ui.activeAllergens.textContent = "";
    var count = 0;
    state.allergens.forEach(function (allergen) {
      if (!state.selectedAllergens[allergen.code]) return;
      count += 1;
      var pill = el("button", "active-allergen-pill");
      pill.type = "button";
      pill.title = allergen.name + " aus der Auswahl entfernen";
      pill.setAttribute("aria-label", allergen.name + " abwählen");
      pill.appendChild(makeChip(allergen.code, false, false));
      pill.appendChild(el("span", "active-allergen-name", allergen.name));
      pill.addEventListener("click", function () { toggleAllergen(allergen.code, false); });
      ui.activeAllergens.appendChild(pill);
    });
    if (count) {
      var clear = el("button", "active-allergen-clear", "×");
      clear.type = "button";
      clear.setAttribute("aria-label", "Alle Allergene abwählen");
      clear.title = "Alle Allergene abwählen";
      clear.addEventListener("click", function () { state.selectedAllergens = {}; applyAllergenHighlights(); });
      ui.activeAllergens.appendChild(clear);
    }
    ui.activeAllergens.hidden = count === 0;
    if (ui.historyReturn && ui.bottomDock) {
      ui.historyReturn.hidden = !state.historyReturn;
      ui.bottomDock.classList.toggle("has-history-return", !!state.historyReturn);
      ui.bottomDock.hidden = count === 0 && !state.historyReturn;
      document.body.classList.toggle("has-bottom-dock", count > 0 || !!state.historyReturn);
    }
    ui.activeAllergens.classList.remove("is-compact");
    if (count) ui.activeAllergens.classList.toggle("is-compact", ui.activeAllergens.scrollWidth > ui.activeAllergens.clientWidth + 1);
  }

  function initAllergenVisibility() {
    var saved = null;
    try { saved = window.localStorage.getItem("speiseplan-hide-allergens"); } catch (e) { /* privater Modus */ }
    state.hideAllergens = saved === null ? true : saved === "true";
    if (!ui.hideAllergens) return;
    if (ui.historyReturn) ui.historyReturn.addEventListener("click", returnToHistoryMenu);
    ui.hideAllergens.checked = !state.hideAllergens;
    document.body.classList.toggle("hide-allergens", state.hideAllergens);
    if (ui.allergenScroll) {
      ui.allergenScroll.addEventListener("click", function () {
        ui.hideAllergens.checked = !ui.hideAllergens.checked;
        ui.hideAllergens.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    ui.hideAllergens.addEventListener("change", function () {
      state.hideAllergens = !ui.hideAllergens.checked;
      document.body.classList.toggle("hide-allergens", state.hideAllergens);
      try { window.localStorage.setItem("speiseplan-hide-allergens", String(state.hideAllergens)); } catch (e) { /* Einstellung gilt bis zum Schließen der Seite */ }
    });
    window.addEventListener("resize", function () {
      syncNoticeStickyHeight();
    });
  }

  /* ------------------------------------------------------------
     Navigation: #2026-09-14 zeigt genau diese Woche, ohne # die neueste
     ------------------------------------------------------------ */
  function route() {
    if (!state.files.length) return;
    closeDetail();
    closeOpenChip();

    var newest = state.files[0];
    var raw = location.hash.replace(/^#/, "");
    try { raw = decodeURIComponent(raw); } catch (e) { /* kaputter Link: wird unten als unbekannt behandelt */ }
    var wanted = raw + ".json";
    var file = state.files.indexOf(wanted) >= 0 ? wanted : newest;
    var unknown = location.hash.length > 1 && file !== wanted;
    var id = ++state.request;
    var animate = !state.firstView;

    renderControls(file);
    showNotice("");

    var weekPromise = state.weekData[file]
      ? Promise.resolve(state.weekData[file])
      : fetchJSON("weeks/" + file);
    weekPromise.then(function (data) {
      if (id !== state.request) return;
      renderWeekAnimated(file, data, animate, function () {
        if (id !== state.request) return;
        var monday = mondayOf(dateFromFile(file));
        var weekIsOver = new Date() > addDays(monday, 7);   // ab Montag der Folgewoche
        var newestMonday = mondayOf(dateFromFile(newest));
        var currentMonday = mondayOf(new Date());
        var noCurrentWeekPlan = newestMonday < currentMonday;
        if (unknown) {
          showNotice(TEXT.unknownWeek);
        } else if (file !== newest) {
          if (noCurrentWeekPlan) showNotice(TEXT.noNewPlan, TEXT.toLatest, "#" + stem(newest));
          else showNotice(TEXT.notCurrent, TEXT.toCurrent, "#" + stem(newest));
        } else if (weekIsOver) {
          showNotice(TEXT.outdated);
        }

        var wasFirstView = state.firstView;
        state.firstView = false;
        var pending = state.pendingNavigation;
        if (pending && pending.week === stem(file)) {
          state.pendingNavigation = null;
          if (pending.historyHighlight || pending.restoreMenu) showNotice("");
          else showNotice(pending.message || "");
          if (pending.scrollToNextMeal) {
            var redirectedNextMeal = ui.plan.querySelector(".meal.is-next");
            if (redirectedNextMeal && file === newest) {
              redirectedNextMeal.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
            }
          }
          var target = pending.date && pending.mealKey
            ? ui.plan.querySelector('.day[data-day-date="' + pending.date + '"] .meal-' + pending.mealKey)
            : null;
          if (target) {
            if (pending.historyHighlight) {
              target.classList.add("is-history-target");
              var mainDish = target.querySelector(".dish-main");
              if (mainDish) mainDish.classList.add("history-target");
            }
            target.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
            if (pending.restoreMenu) {
              var returnDish = target.querySelector(".dish-main");
              state.historyReturn = null;
              if (returnDish) returnDish.click();
              renderActiveAllergens();
            }
          }
        } else if (wasFirstView) {
          var nextMealRow = ui.plan.querySelector(".meal.is-next");
          if (nextMealRow && file === newest) {
            nextMealRow.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
          }
        }
      });
    }).catch(function (err) {
      if (id !== state.request) return;
      if (window.console) console.error(err);
      ui.label.textContent = "";
      ui.meta.textContent = "";
      showMessage(TEXT.weekError + " (" + file + ")");
    });
  }

  function go(target) {
    if (target) location.hash = target;
  }

  ui.prev.addEventListener("click", function () { clearHistoryReturn(); go(ui.prev.dataset.target); });
  ui.next.addEventListener("click", function () { clearHistoryReturn(); go(ui.next.dataset.target); });
  ui.select.addEventListener("change", function () { clearHistoryReturn(); go(ui.select.value); });
  window.addEventListener("hashchange", function () {
    var pending = state.pendingNavigation;
    if (!pending || (!pending.historyHighlight && !pending.restoreMenu)) clearHistoryReturn();
    route();
  });
  window.addEventListener("scroll", hideHoverBox, { passive: true });
  window.addEventListener("resize", hideHoverBox);
  // Shared-meal info is hoverable on desktop and tap-to-toggle on touch screens.
  document.addEventListener("click", function (event) {
    var info = event.target.closest && event.target.closest(".shared-meal-info");
    if (info && !canHover()) {
      var show = !info.classList.contains("is-open");
      document.querySelectorAll(".shared-meal-info.is-open").forEach(function (openInfo) {
        openInfo.classList.remove("is-open");
        openInfo.setAttribute("aria-expanded", "false");
      });
      if (show) {
        info.classList.add("is-open");
        info.setAttribute("aria-expanded", "true");
      }
      event.stopPropagation();
    } else if (!info) {
      document.querySelectorAll(".shared-meal-info.is-open").forEach(function (openInfo) {
        openInfo.classList.remove("is-open");
        openInfo.setAttribute("aria-expanded", "false");
      });
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".shared-meal-info.is-open").forEach(function (openInfo) {
      openInfo.classList.remove("is-open");
      openInfo.setAttribute("aria-expanded", "false");
    });
  });

  /* ------------------------------------------------------------
     Start
     ------------------------------------------------------------ */
  showMessage(TEXT.loading);
  initAllergenVisibility();

  // Uhrzeiten neben "Mittagessen"/"Abendessen" oben in der Leiste (nur am PC sichtbar).
  (function initMealTimeLabels() {
    var lunchEl = $("gh-lunch"), dinnerEl = $("gh-dinner");
    if (lunchEl) { lunchEl.appendChild(document.createTextNode(" ")); lunchEl.appendChild(el("span", "meal-time", formatRange(MEAL_TIMES.lunch))); }
    if (dinnerEl) { dinnerEl.appendChild(document.createTextNode(" ")); dinnerEl.appendChild(el("span", "meal-time", formatRange(MEAL_TIMES.dinner))); }
  })();

  // Legende, Allergenfarben und Gericht-Fotos sind optional: fehlen die Dateien,
  // funktioniert der Rest der Seite trotzdem.
  var legendReady = fetchJSON("allergens.json").then(function (data) {
    setAllergens(data);
    renderLegend();
  }).catch(function () { /* ohne Legende weitermachen */ });

  var dishesReady = fetchJSON("dishes.json").then(function (data) {
    setDishes(data);
  }).catch(function () { /* ohne Fotos/Beschreibungen weitermachen */ });

  fetchText("weeks/index.txt").then(function (text) {
    var seen = {};
    state.files = text.split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(function (line) {
        if (!FILE_RE.test(line) || seen[line]) return false;   // Kommentare (#) und Leerzeilen fallen hier raus
        seen[line] = true;
        return true;
      })
      .sort()
      .reverse();

    if (!state.files.length) {
      ui.label.textContent = "";
      showMessage(TEXT.noWeeks);
      return;
    }
    var seatingReady = fetchText("sitzordnungen/index.txt").then(setSeatingPlanIndex).catch(function () { state.seatingFiles = {}; });
    return Promise.all([legendReady, dishesReady, seatingReady]).then(loadSchoolYearHistory).then(route);
  }).catch(function (err) {
    if (window.console) console.error(err);
    ui.label.textContent = "";
    showMessage(TEXT.loadError);
  });
})();
