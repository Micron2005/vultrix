// QNA AutoZone / O'Reilly Vehicle Auto-Switcher
//
// Our shop app opens AZP / First Call with a URL hash like:
//   #qna-vin=1HGCM82633A004352
//   #qna-plate=ABC1234&qna-state=VA
//
// This script watches for an ADD VEHICLE DIALOG to appear on the
// supplier's page and fills the VIN / plate input inside that dialog.
//
// CRITICAL: we only fill inputs that live inside a container that is
// clearly an Add-Vehicle modal (role=dialog OR text "Add Vehicle" /
// "My Garage" / "Manage Vehicle" / "Select Vehicle"). We never fill
// the page's part-search bar, even if its placeholder mentions "VIN".
// Page-level search inputs ([type=search], role="search", header/nav)
// are excluded outright.
//
// We never auto-click ADD. The user always confirms.

(function () {
  "use strict";

  const STYLE_ID = "qna-az-style";
  const BAR_ID = "qna-az-bar";

  /** Words whose presence in a container's text means "this is the Add Vehicle area". */
  const DIALOG_TEXT_RE =
    /(add\s*(?:a\s*)?vehicle|new\s*vehicle|my\s*garage|manage\s*vehicles?|select\s*vehicle|vehicle\s*manager|change\s*vehicle)/i;

  function parseQnaHash() {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const vin = (params.get("qna-vin") || "").trim().toUpperCase();
    const plate = (params.get("qna-plate") || "").trim().toUpperCase();
    const state = (params.get("qna-state") || "").trim().toUpperCase();
    if (vin.length === 17) return { kind: "vin", value: vin };
    if (plate) return { kind: "plate", value: plate, state };
    return null;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #${BAR_ID} {
        position: fixed; bottom: 16px; right: 16px; z-index: 2147483647;
        background: #111; color: #fff; border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        font: 13px/1.3 system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
        padding: 12px 14px; max-width: 360px;
      }
      #${BAR_ID} .qna-title { font-weight: 600; margin-bottom: 4px; }
      #${BAR_ID} .qna-mono { font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: 12px; background: #222; border-radius: 6px; padding: 2px 6px;
        letter-spacing: 0.5px; }
      #${BAR_ID} .qna-row { margin-top: 6px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
      #${BAR_ID} button {
        background: #f97316; color: #111; border: 0; border-radius: 6px;
        padding: 6px 10px; font-weight: 600; cursor: pointer; font-size: 12px;
      }
      #${BAR_ID} button.qna-ghost {
        background: transparent; color: #fff; border: 1px solid #555; font-weight: 400;
      }
      #${BAR_ID} .qna-hint { color: #d4d4d8; font-size: 12px; margin-top: 6px; }
      #${BAR_ID} .qna-ok { color: #a7f3d0; font-size: 12px; margin-top: 6px; }
      #${BAR_ID} .qna-err { color: #fca5a5; font-size: 12px; margin-top: 6px; }
    `;
    document.documentElement.appendChild(s);
  }

  function makeBar(payload) {
    injectStyles();
    let bar = document.getElementById(BAR_ID);
    if (bar) bar.remove();
    bar = document.createElement("div");
    bar.id = BAR_ID;
    const kindLabel = payload.kind === "vin" ? "VIN" : "Plate";
    const stateLabel =
      payload.kind === "plate" && payload.state ? ` (${payload.state})` : "";
    bar.innerHTML = `
      <div class="qna-title">QNA: set vehicle</div>
      <div>
        ${kindLabel}: <span class="qna-mono">${payload.value}</span>${stateLabel}
      </div>
      <div class="qna-hint">
        Opening Add Vehicle… ${kindLabel} will fill automatically. You'll only
        need to click <b>ADD</b>. If nothing opens, use <b>Fill now</b>.
      </div>
      <div class="qna-row">
        <button id="qna-fill">Fill now</button>
        <button id="qna-copy" class="qna-ghost">Copy ${kindLabel}</button>
        <button id="qna-dismiss" class="qna-ghost">×</button>
      </div>
      <div id="qna-status" hidden></div>
    `;
    document.body.appendChild(bar);

    const setStatus = (msg, level) => {
      const el = document.getElementById("qna-status");
      if (!el) return;
      el.textContent = msg;
      el.hidden = false;
      el.className =
        level === "err" ? "qna-err" : level === "ok" ? "qna-ok" : "qna-hint";
    };

    document.getElementById("qna-fill").addEventListener("click", () => {
      const result = fillAddVehicle(payload);
      if (result.ok) {
        setStatus("Filled. Click ADD on their dialog.", "ok");
      } else {
        setStatus(
          `Couldn't find an Add Vehicle dialog yet. ${result.reason}`,
          "err",
        );
      }
    });
    document.getElementById("qna-copy").addEventListener("click", () => {
      navigator.clipboard
        ?.writeText(payload.value)
        .then(() => setStatus("Copied to clipboard.", "ok"))
        .catch(() => setStatus("Clipboard unavailable.", "err"));
    });
    document.getElementById("qna-dismiss").addEventListener("click", () => {
      bar.remove();
    });
  }

  /**
   * Find the Add-Vehicle container on the page, if one is currently
   * visible. Returns the container Element or null.
   *
   * Heuristics (in order):
   *   1. An open role=dialog / aria-modal element whose visible text
   *      matches DIALOG_TEXT_RE.
   *   2. An element with a class containing "modal" / "dialog" /
   *      "drawer" / "overlay" that is visible and contains DIALOG_TEXT_RE.
   *   3. An element that directly contains a heading (h1-h4, legend,
   *      [role=heading]) whose text matches DIALOG_TEXT_RE — a dialog
   *      doesn't need to use aria roles to be obvious to the user.
   *
   * Returns null for the landing page / top-bar search area.
   */
  function findAddVehicleContainer() {
    const dialogs = document.querySelectorAll(
      [
        '[role="dialog"]:not([aria-hidden="true"])',
        '[aria-modal="true"]',
        '[class*="modal" i]',
        '[class*="Modal"]',
        '[class*="dialog" i]',
        '[class*="Dialog"]',
        '[class*="drawer" i]',
        '[class*="overlay" i]',
        '[data-testid*="modal" i]',
        '[data-testid*="dialog" i]',
        '[data-testid*="vehicle" i]',
      ].join(","),
    );
    for (const el of dialogs) {
      if (!isVisible(el)) continue;
      const txt = (el.textContent || "").slice(0, 4000);
      if (DIALOG_TEXT_RE.test(txt)) return el;
    }
    // Fall back: any visible heading matching the regex, scoped to its
    // nearest section/form/aside/div ancestor.
    const headings = document.querySelectorAll(
      'h1, h2, h3, h4, legend, [role="heading"]',
    );
    for (const h of headings) {
      if (!isVisible(h)) continue;
      if (DIALOG_TEXT_RE.test(h.textContent || "")) {
        const scope =
          h.closest("form, section, aside, dialog, [role='dialog']") ||
          h.parentElement;
        if (scope && isVisible(scope)) return scope;
      }
    }
    return null;
  }

  /**
   * Hard blocklist: never touch these inputs, even if the label matches.
   * This is what protected us from filling AZP's "Search by VIN or part"
   * input in the top nav.
   */
  function isSearchInput(input) {
    if (!input) return true;
    if (input.type === "search") return true;
    if (input.getAttribute("role") === "searchbox") return true;
    // Search ancestors
    if (
      input.closest(
        '[role="search"], [role="searchbox"], header, nav, [class*="search" i], [class*="Search"], [data-testid*="search" i]',
      )
    ) {
      return true;
    }
    const hay = collectLabelText(input);
    if (/search|keyword|part\s*#|partnumber|part\s*number/i.test(hay)) {
      return true;
    }
    return false;
  }

  function findVinInputInContainer(container) {
    const inputs = Array.from(
      container.querySelectorAll(
        'input[type="text"], input[type="tel"], input:not([type])',
      ),
    );
    // First pass: label-based VIN match
    for (const input of inputs) {
      if (!isVisible(input)) continue;
      if (isSearchInput(input)) continue;
      const hay = collectLabelText(input);
      if (/(^|\W)vin(\W|$)|vehicle\s*identification/i.test(hay)) {
        return input;
      }
    }
    // Second pass: maxlength=17 inside Add Vehicle container, not search
    for (const input of inputs) {
      if (!isVisible(input)) continue;
      if (isSearchInput(input)) continue;
      if (input.getAttribute("maxlength") === "17") return input;
    }
    return null;
  }

  function findPlateInputInContainer(container) {
    const inputs = Array.from(
      container.querySelectorAll(
        'input[type="text"], input[type="tel"], input:not([type])',
      ),
    );
    for (const input of inputs) {
      if (!isVisible(input)) continue;
      if (isSearchInput(input)) continue;
      const hay = collectLabelText(input);
      if (/license\s*plate|plate\s*number|tag\s*(number|#)/i.test(hay)) {
        return input;
      }
    }
    return null;
  }

  function collectLabelText(input) {
    const parts = [];
    if (input.placeholder) parts.push(input.placeholder);
    if (input.name) parts.push(input.name);
    if (input.id) parts.push(input.id);
    if (input.getAttribute("aria-label")) {
      parts.push(input.getAttribute("aria-label"));
    }
    const labelledBy = input.getAttribute("aria-labelledby");
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        const labelEl = document.getElementById(id);
        if (labelEl?.textContent) parts.push(labelEl.textContent);
      }
    }
    if (input.id) {
      const assoc = document.querySelector(`label[for="${cssEsc(input.id)}"]`);
      if (assoc?.textContent) parts.push(assoc.textContent);
    }
    const parentLabel = input.closest("label");
    if (parentLabel?.textContent) parts.push(parentLabel.textContent);
    return parts.join(" | ").toLowerCase();
  }

  function cssEsc(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return s.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }

  function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (el.disabled) return false;
    return true;
  }

  function setNativeValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keyup", { bubbles: true, key: "End" }),
    );
  }

  function fillAddVehicle(payload) {
    const container = findAddVehicleContainer();
    if (!container) {
      return {
        ok: false,
        reason:
          "Click Change / Manage / Add Vehicle on their page first, then hit Fill again.",
      };
    }
    if (payload.kind === "vin") {
      const input = findVinInputInContainer(container);
      if (!input) {
        return {
          ok: false,
          reason:
            "Found the dialog but no VIN input in it — try pasting manually (Copy VIN button below).",
        };
      }
      input.focus();
      setNativeValue(input, payload.value);
      return { ok: true };
    }
    // plate
    const plateInput = findPlateInputInContainer(container);
    if (!plateInput) {
      return {
        ok: false,
        reason:
          "Found the dialog but no Plate input in it — try pasting manually.",
      };
    }
    plateInput.focus();
    setNativeValue(plateInput, payload.value);
    if (payload.state) {
      const stateSelect = findSelectInContainer(container, [/state/i]);
      if (stateSelect) {
        const target = payload.state.toUpperCase();
        for (const opt of stateSelect.options) {
          if (opt.value.toUpperCase() === target) {
            stateSelect.value = opt.value;
            stateSelect.dispatchEvent(new Event("change", { bubbles: true }));
            break;
          }
        }
      }
    }
    return { ok: true };
  }

  function findSelectInContainer(container, regexes) {
    const selects = Array.from(container.querySelectorAll("select"));
    for (const sel of selects) {
      if (!isVisible(sel)) continue;
      const hay = collectLabelText(sel);
      for (const re of regexes) if (re.test(hay)) return sel;
    }
    return null;
  }

  /**
   * Try to auto-click AZP / First Call's "Change" / "Manage" /
   * "Add Vehicle" trigger so the Add Vehicle dialog opens without the
   * user doing it. We never submit a form — worst case an unrelated
   * menu opens.
   *
   * Strategy, in order:
   *
   *   A. Find an anchor whose href clearly belongs to the vehicle
   *      management area (manage-vehicles, my-garage, add-vehicle,
   *      select-vehicle). AZP's top bar sits a plain "Change" button
   *      next to exactly this kind of link. Click the nearest visible
   *      button/link in that region whose text is change/manage/edit/
   *      switch/add.
   *   B. Fall back: any button whose aria-label or text together
   *      mention a vehicle action (change vehicle, manage vehicle,
   *      my garage, add vehicle, etc.).
   *
   * Returns true if a click was dispatched.
   */
  const VEHICLE_HREF_SELECTOR = [
    'a[href*="manage-vehicle" i]',
    'a[href*="manage-vehicles" i]',
    'a[href*="my-garage" i]',
    'a[href*="my-vehicle" i]',
    'a[href*="select-vehicle" i]',
    'a[href*="add-vehicle" i]',
    'a[href*="add-a-vehicle" i]',
  ].join(",");

  const ACTION_TEXT_RE =
    /^\s*(change|manage|edit|switch|add(?:\s+vehicle)?|select)\s*$/i;

  function clickIfActionButtonIn(scope) {
    const buttons = Array.from(
      scope.querySelectorAll('button, a, [role="button"]'),
    );
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      // Skip the manage-vehicles <a> itself so we click the sibling
      // "Change" button (which opens the dialog in place) rather than
      // navigating away to a separate management page.
      if (b.tagName === "A" && /manage-vehicle|my-garage/i.test(b.href || "")) {
        continue;
      }
      const aria = b.getAttribute("aria-label") || "";
      const text = (b.textContent || "").trim();
      const acc = `${aria} ${text}`.trim();
      if (ACTION_TEXT_RE.test(acc) || /change|manage|edit|switch|add/i.test(aria)) {
        try {
          b.click();
          return true;
        } catch {
          // keep searching
        }
      }
    }
    return false;
  }

  function tryClickChangeButton() {
    // Strategy A: look for a vehicle-management anchor and click the
    // Change/Manage button in its vicinity (walk up a few ancestors).
    const links = Array.from(document.querySelectorAll(VEHICLE_HREF_SELECTOR));
    for (const link of links) {
      if (!isVisible(link)) continue;
      let node = link.parentElement;
      for (let depth = 0; depth < 6 && node; depth++) {
        if (clickIfActionButtonIn(node)) return true;
        node = node.parentElement;
      }
    }

    // Strategy B: fall back to semantic label matching.
    const candidates = Array.from(
      document.querySelectorAll('button, a, [role="button"]'),
    );
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const aria = el.getAttribute("aria-label") || "";
      const text = (el.textContent || "").trim();
      const acc = `${aria} ${text}`.toLowerCase().replace(/\s+/g, " ").trim();
      if (!acc) continue;
      if (
        /\b(change|manage|edit|switch|pick|select)\b[^.]*\bvehicle/.test(acc) ||
        /\bvehicle[^.]*\b(change|manage|edit|switch|picker|selector)\b/.test(
          acc,
        ) ||
        /\bmy\s+garage\b/.test(acc) ||
        /\badd\s+(?:a\s+)?vehicle\b/.test(acc)
      ) {
        try {
          el.click();
          return true;
        } catch {
          // keep searching
        }
      }
    }
    return false;
  }

  // --- main ---

  // Key for remembering the URL we want to return to after the user
  // submits the Add Vehicle dialog. AZP sometimes redirects to their
  // home / garage page after ADD, losing the part-search query — we
  // navigate back there automatically so the user doesn't re-search.
  const RESUME_KEY = "qna_resume_url";

  function stripQnaHash(url) {
    return url.replace(/[#&]qna-[^&#]*/g, "").replace(/[#?]$/, "");
  }

  function run() {
    const payload = parseQnaHash();

    if (!payload) {
      // No hash on this page. If we had stashed a "return here after
      // vehicle is added" URL in sessionStorage (previous navigation in
      // this same tab), and the current URL differs, resume it.
      try {
        const resume = sessionStorage.getItem(RESUME_KEY);
        if (resume && resume !== location.href) {
          sessionStorage.removeItem(RESUME_KEY);
          location.replace(resume);
        }
      } catch {
        // sessionStorage not available — nothing to do
      }
      return;
    }

    makeBar(payload);

    // Remember where to return after the user clicks ADD.
    try {
      sessionStorage.setItem(RESUME_KEY, stripQnaHash(location.href));
    } catch {
      // ignore
    }

    // Strip the #qna- fragment from the live URL so a subsequent
    // refresh / AZP-triggered reload doesn't retrigger the flow.
    try {
      const cleanUrl = stripQnaHash(location.href);
      if (cleanUrl !== location.href) {
        history.replaceState(history.state, document.title, cleanUrl);
      }
    } catch {
      // ignore
    }

    // Once we've decided to navigate back to the resume URL, block all
    // further auto-clicks and fills so the dialog can't re-open.
    let resumeInitiated = false;

    // Try to open the Add Vehicle dialog automatically. If the page is
    // still loading we may find the button after the first mutation.
    let clickedOnce = false;
    const tryClickOnce = () => {
      if (clickedOnce || resumeInitiated) return;
      if (tryClickChangeButton()) {
        clickedOnce = true;
      }
    };
    setTimeout(tryClickOnce, 500);
    setTimeout(tryClickOnce, 1500);
    setTimeout(tryClickOnce, 3000);

    // Watch for the Add Vehicle dialog to appear; once it does, fill.
    let filledAt = 0;
    let dialogWasOpen = false;
    const tryFillCycle = () => {
      if (resumeInitiated) return;
      const container = findAddVehicleContainer();
      if (container) {
        dialogWasOpen = true;
        if (Date.now() - filledAt < 5000) return; // cooldown
        setTimeout(() => {
          if (resumeInitiated) return;
          const result = fillAddVehicle(payload);
          if (result.ok) {
            filledAt = Date.now();
            const status = document.getElementById("qna-status");
            if (status) {
              status.textContent = "Filled. AZP should auto-add the vehicle.";
              status.className = "qna-ok";
              status.hidden = false;
            }
          }
        }, 120);
      } else if (dialogWasOpen) {
        // Dialog was open and now closed. Assume vehicle was added.
        // Navigate back to the resume URL so the part search refreshes
        // under the new vehicle in scope.
        dialogWasOpen = false;
        resumeInitiated = true;
        try {
          const resume = sessionStorage.getItem(RESUME_KEY);
          if (resume) {
            sessionStorage.removeItem(RESUME_KEY);
            setTimeout(() => {
              // Always use location.replace against the clean (hash-
              // stripped) resume URL. Even if it equals the current
              // location, replace triggers a refresh without carrying
              // the #qna- fragment.
              location.replace(resume);
            }, 400);
          }
        } catch {
          // ignore
        }
      }
    };

    const mo = new MutationObserver(tryFillCycle);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    tryFillCycle();
    // Stop after 10 minutes to avoid persistent observation.
    setTimeout(() => mo.disconnect(), 10 * 60 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
