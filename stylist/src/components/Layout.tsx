import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  Bookmark,
  Camera,
  CalendarDays,
  Menu,
  MessageCircle,
  Moon,
  PersonStanding,
  Shirt,
  ShoppingBag,
  Sparkles,
  Sun,
  SunMedium,
  User,
} from "lucide-react";
import { useUI } from "../store";
import { Modal } from "./ui";

const NAV = [
  { to: "/", label: "Сегодня", icon: SunMedium },
  { to: "/stylist", label: "Стилист", icon: Sparkles },
  { to: "/wardrobe", label: "Гардероб", icon: Shirt },
  { to: "/fitting", label: "Примерочная", icon: PersonStanding },
  { to: "/looks", label: "Образы", icon: Bookmark },
  { to: "/calendar", label: "Календарь", icon: CalendarDays },
  { to: "/mirror", label: "Зеркало", icon: Camera },
  { to: "/shop", label: "Тренды и шопинг", icon: ShoppingBag },
  { to: "/chat", label: "Чат со стилистом", icon: MessageCircle },
  { to: "/profile", label: "Профиль и мерки", icon: User },
];

const MOBILE = ["/", "/wardrobe", "/stylist", "/fitting"];

export function Layout({ children }: { children: ReactNode }) {
  const { theme, setTheme, health } = useUI();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  return (
    <div className="min-h-dvh lg:pl-72">
      {/* Sidebar */}
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-66 flex-col rounded-3xl p-4 lg:flex">
        <Brand />
        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition",
                  isActive ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )
              }
            >
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-surface-2 p-3 text-xs">
          <AiStatus />
          <button className="btn-icon h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Тема">
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="glass sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden">
        <Brand compact />
        <div className="flex items-center gap-2">
          <span className={clsx("h-2 w-2 rounded-full", health?.ai ? "bg-ok" : "bg-warn")} title={health?.ai ? "ИИ подключён" : "ИИ не подключён"} />
          <button className="btn-icon h-9 w-9" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Тема">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main key={loc.pathname} className="rise mx-auto max-w-7xl overflow-x-clip px-4 pt-5 pb-28 sm:px-6 lg:pt-8 lg:pb-10">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="glass safe-bottom fixed inset-x-2 bottom-2 z-30 flex items-center justify-around rounded-3xl px-2 pt-2 lg:hidden">
        {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) =>
              clsx("flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[10px] font-bold", isActive ? "text-fg" : "text-muted")
            }
          >
            {({ isActive }) => (
              <>
                <span className={clsx("flex h-8 w-12 items-center justify-center rounded-full transition", isActive && "bg-surface-3")}>
                  <n.icon size={19} />
                </span>
                {n.label}
              </>
            )}
          </NavLink>
        ))}
        <button onClick={() => setMenu(true)} className="flex min-w-14 flex-col items-center gap-1 px-2 py-1.5 text-[10px] font-bold text-muted">
          <span className="flex h-8 w-12 items-center justify-center rounded-full">
            <Menu size={19} />
          </span>
          Ещё
        </button>
      </nav>
      <Modal open={menu} onClose={() => setMenu(false)} title="Разделы">
        <div className="grid grid-cols-2 gap-2">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} onClick={() => setMenu(false)} className="flex items-center gap-2.5 rounded-2xl bg-surface-2 p-3 text-sm font-semibold">
              <n.icon size={18} className="text-accent" />
              {n.label}
            </NavLink>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-surface-2 p-3 text-xs">
          <AiStatus />
        </div>
      </Modal>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <NavLink to="/" className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className={compact ? "h-8 w-8" : "h-10 w-10"} />
      <div>
        <div className="font-display text-2xl leading-none font-semibold">Atelier</div>
        {!compact && <div className="text-[11px] font-semibold text-muted">персональный ИИ-стилист</div>}
      </div>
    </NavLink>
  );
}

function AiStatus() {
  const health = useUI((s) => s.health);
  if (!health) return <span className="text-muted">Проверяю сервер…</span>;
  if (!health.ok) return <span className="text-bad">Сервер недоступен</span>;
  return health.ai ? (
    <span className="flex items-center gap-2 font-semibold">
      <span className="h-2 w-2 rounded-full bg-ok" />
      Claude подключён
    </span>
  ) : (
    <span className="flex items-center gap-2 font-semibold text-warn" title="Добавьте ANTHROPIC_API_KEY в .env">
      <span className="h-2 w-2 rounded-full bg-warn" />
      Офлайн-режим
    </span>
  );
}
