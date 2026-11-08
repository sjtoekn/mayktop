"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Icon from "@/components/shell/Icon";

export type TabItem = {
  id: string;
  label: string;
  icon: string;
  panel: ReactNode;
};

// Posts / About / Likes / Saved / Communities.
// The panels are prepared on the server; this only decides which one is visible.
export default function ProfileTabs({
  tabs,
  label,
  aside,
}: {
  tabs: TabItem[];
  label: string;
  aside?: ReactNode; // cards shown beside the tab content (About Me, Interests, Badges)
}) {
  const [active, setActive] = useState(tabs[0].id);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let next = -1;
    if (e.key === forward) next = (index + 1) % tabs.length;
    else if (e.key === back) next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(tabs[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <>
      <div className="card pf-tablist" role="tablist" aria-label={label}>
        {tabs.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              id={`pf-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`pf-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={`pf-tab ${selected ? "pf-tabActive" : ""}`}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <Icon name={tab.icon} size={22} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="pf-cols">
        <div className="pf-colsInner">
        <div className="pf-panels">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`pf-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`pf-tab-${tab.id}`}
            hidden={tab.id !== active}
            className="pf-panel"
          >
            {tab.panel}
          </div>
        ))}
        </div>
        {aside && <aside className="pf-aside">{aside}</aside>}
        </div>
      </div>
    </>
  );
}
