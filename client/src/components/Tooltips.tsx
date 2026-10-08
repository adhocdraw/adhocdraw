// Copyright 2026 Vikranth Pandiri
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from "react";

// Quick, consistent tooltips for the whole app. The browser's own `title`
// tooltip waits 1-3 seconds, which feels broken for icon buttons; this shows a
// tip after a short delay on hover and on keyboard focus, using the element's
// `title`, `data-tip`, or - for buttons with no visible text - its aria-label.
// While a tip is showing, the native `title` is taken off the element (and put
// back afterwards) so the slow browser tooltip doesn't appear as well.

const SHOW_DELAY_MS = 250;
const SELECTOR = "[title], [data-tip], button[aria-label], [role='button'][aria-label]";

function tipFor(target: EventTarget | null): { host: HTMLElement; text: string } | null {
  if (!(target instanceof Element)) return null;
  const host = target.closest<HTMLElement>(SELECTOR);
  if (!host) return null;
  // innerText (not textContent): a label hidden by the responsive toolbar is not "visible".
  const visible = (host.innerText ?? "").trim();
  const text = host.dataset.tip ?? host.dataset.tipTitle ?? host.getAttribute("title") ?? host.getAttribute("aria-label");
  if (!text || text === visible) return null;
  return { host, text };
}

export default function Tooltips() {
  useEffect(() => {
    let host: HTMLElement | null = null;
    let tipEl: HTMLDivElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let watch: ReturnType<typeof setInterval> | undefined;

    const restoreTitle = () => {
      if (host && host.dataset.tipTitle !== undefined) {
        host.setAttribute("title", host.dataset.tipTitle);
        delete host.dataset.tipTitle;
      }
    };

    const hide = () => {
      clearTimeout(timer);
      clearInterval(watch);
      restoreTitle();
      tipEl?.remove();
      tipEl = null;
      host = null;
    };

    const position = () => {
      if (!tipEl || !host) return;
      const r = host.getBoundingClientRect();
      const t = tipEl.getBoundingClientRect();
      const margin = 6;
      let top = r.bottom + margin;
      if (top + t.height > window.innerHeight - 4) top = r.top - t.height - margin;
      const left = Math.min(Math.max(r.left + r.width / 2 - t.width / 2, 4), window.innerWidth - t.width - 4);
      tipEl.style.top = `${Math.max(top, 4)}px`;
      tipEl.style.left = `${left}px`;
    };

    const show = (h: HTMLElement, text: string) => {
      host = h;
      // Take the native tooltip out of the way for as long as ours shows.
      const nativeTitle = h.getAttribute("title");
      if (nativeTitle !== null) {
        h.dataset.tipTitle = nativeTitle;
        h.removeAttribute("title");
      }
      tipEl = document.createElement("div");
      tipEl.className = "app-tooltip";
      tipEl.setAttribute("role", "tooltip");
      tipEl.textContent = text;
      document.body.appendChild(tipEl);
      position();
      // The element can disappear under a still tip (menu closed, tab removed).
      watch = setInterval(() => {
        if (!host || !host.isConnected) hide();
      }, 400);
    };

    const schedule = (target: EventTarget | null, delay: number) => {
      const found = tipFor(target);
      if (found && found.host === host) return;
      hide();
      if (!found) return;
      const { host: h, text } = found;
      timer = setTimeout(() => show(h, text), delay);
      // Remember who we are waiting on, so leaving can cancel it.
      host = h;
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      schedule(e.target, SHOW_DELAY_MS);
    };
    const onOut = (e: PointerEvent) => {
      if (host && e.relatedTarget instanceof Node && host.contains(e.relatedTarget)) return;
      hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) schedule(e.target, SHOW_DELAY_MS);
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("wheel", hide, { passive: true, capture: true });
    return () => {
      hide();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("wheel", hide, true);
    };
  }, []);

  return null;
}
