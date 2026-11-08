"use client";

// Light/Dark button. Saves the choice in the browser (localStorage "theme") and sets
// <html data-theme="light|dark">. With no saved choice the site follows the device setting.
//
// The current theme lives outside React (on the <html> tag), so we read it with
// useSyncExternalStore instead of copying it into state inside an effect.
import { useSyncExternalStore } from "react";
import Icon from "./Icon";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onChange);
  };
}

function getSnapshot(): Theme | null {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// On the server we do not know the theme yet (same as before: shows the moon icon).
function getServerSnapshot(): Theme | null {
  return null;
}

export default function ThemeToggle({ label }: { label: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode: the choice just lasts for this visit */
    }
    listeners.forEach((notify) => notify());
  }

  return (
    <button className="ch-iconBtn" onClick={toggle} aria-label={label} title={label}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={24} />
    </button>
  );
}
