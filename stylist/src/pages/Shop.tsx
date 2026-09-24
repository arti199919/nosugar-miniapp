import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import { ExternalLink, RefreshCw, Search, Sparkles, TrendingUp, Layers, ShoppingBag } from "lucide-react";
import { toBrief } from "@shared/catalog";
import type { CapsuleReport, ShopResult, TrendReport, WardrobeItem } from "@shared/types";
import { api } from "../api";
import { ItemThumb, OutfitCollage } from "../components/items";
import { AiBadge, Field, PageHeader, Segmented, Spinner } from "../components/ui";
import { getKV, getTrends, setKV, useItems, useProfile } from "../db";
import { CAPSULE_GOALS, localCapsule, localTrends } from "../lib/capsule";
import { todayISO } from "../lib/dates";
import { trendsDigest } from "../lib/planner";
import { errorText, toast, useUI } from "../store";

type Tab = "trends" | "capsule" | "search";

export default function Shop() {
  const loc = useLocation() as { state?: { query?: string } };
  const [tab, setTab] = useState<Tab>(loc.state?.query ? "search" : "trends");
  const [query, setQuery] = useState(loc.state?.query ?? "");
  const goSearch = (q: string) => {
    setQuery(q);
    setTab("search");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div>
      <PageHeader
        title="Тренды и шопинг"
        subtitle="Что носят сейчас, какие капсулы собрать и где купить в России — под ваши размеры."
        actions={
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "trends", label: <span className="flex items-center gap-1.5"><TrendingUp size={14} /> Тренды</span> },
              { value: "capsule", label: <span className="flex items-center gap-1.5"><Layers size={14} /> Капсулы</span> },
              { value: "search", label: <span className="flex items-center gap-1.5"><ShoppingBag size={14} /> Поиск</span> },
            ]}
          />
        }
      />
      {tab === "trends" && <Trends onSearch={goSearch} />}
      {tab === "capsule" && <Capsules onSearch={goSearch} />}
      {tab === "search" && <ShopSearch initial={query} key={query} />}
    </div>
  );
}

function Trends({ onSearch }: { onSearch: (q: string) => void }) {
  const profile = useProfile();
  const items = useItems();
  const ai = useUI((s) => s.health?.ai);
  const [report, setReport] = useState<TrendReport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTrends().then((t) => {
      if (t) setReport(t);
      else if (profile) setReport(localTrends(profile));
    });
  }, [profile]);

  const refresh = async () => {
    if (!profile) return;
    if (!ai) return setReport(localTrends(profile));
    setBusy(true);
    try {
      const t = await api.trends({ gender: profile.gender, city: profile.home?.label, styles: profile.style.preferred, date: todayISO() });
      await setKV("trends", t);
      setReport(t);
      toast("Тренды обновлены", "ok");
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(false);
  };

  const matches = (keys: string[]): WardrobeItem[] => {
    const words = keys.flatMap((k) => k.toLowerCase().split(/\s+/)).filter((w) => w.length > 4).map((w) => w.slice(0, 5));
    return (items ?? []).filter((i) => i.status === "active" && words.some((w) => `${i.name} ${i.subtype ?? ""}`.toLowerCase().includes(w))).slice(0, 4);
  };

  if (!report) return <Spinner />;
  const stale = report.source === "ai" && Date.now() - report.fetchedAt > 7 * 86400000;
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <div className="mb-1 flex items-center gap-2">
              <AiBadge source={report.source} />
              {report.source === "ai" && <span className="text-xs text-muted">обновлено {new Date(report.fetchedAt).toLocaleDateString("ru-RU")}</span>}
            </div>
            <h2 className="font-display text-3xl font-semibold">{report.season}</h2>
            <p className="mt-2 text-sm text-muted">{report.summary}</p>
          </div>
          <button className="btn-primary" onClick={refresh} disabled={busy}>
            {busy ? <Spinner /> : <RefreshCw size={16} />} {ai ? (stale ? "Тренды устарели — обновить" : "Найти свежие тренды") : "Обновить"}
          </button>
        </div>
        {busy && <p className="mt-3 text-xs text-muted">Claude ищет в интернете свежие обзоры показов и стритстайла — это займёт до минуты.</p>}
        {report.colors.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {report.colors.map((c) => (
              <span key={c.name} className="chip py-1.5">
                <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: c.hex }} /> {c.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {report.trends.map((t) => {
          const have = matches(t.keyItems);
          return (
            <div key={t.title} className="card flex flex-col gap-3 p-5">
              <div className="text-lg font-bold">{t.title}</div>
              <p className="text-sm text-muted">{t.description}</p>
              <p className="rounded-2xl bg-surface-2 p-3 text-sm">
                <b>Как носить:</b> {t.howToWear}
              </p>
              {have.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-bold text-ok">Уже есть в гардеробе</div>
                  <div className="flex gap-1.5">
                    {have.map((i) => (
                      <ItemThumb key={i.id} item={i} className="h-12 w-12" />
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-auto flex flex-wrap gap-1.5">
                {t.keyItems.map((k) => (
                  <button key={k} className="chip" onClick={() => onSearch(k)}>
                    <Search size={12} /> {k}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {(report.antiTrends.length > 0 || report.sources.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {report.antiTrends.length > 0 && (
            <div className="card p-5">
              <div className="mb-2 font-bold">Уходит из моды</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {report.antiTrends.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {report.sources.length > 0 && (
            <div className="card p-5">
              <div className="mb-2 font-bold">Источники</div>
              <ul className="space-y-1 text-sm">
                {report.sources.slice(0, 8).map((s) => (
                  <li key={s.url} className="truncate">
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Capsules({ onSearch }: { onSearch: (q: string) => void }) {
  const profile = useProfile();
  const items = useItems();
  const ai = useUI((s) => s.health?.ai);
  const [goal, setGoal] = useState(CAPSULE_GOALS[0].id);
  const [custom, setCustom] = useState("");
  const [report, setReport] = useState<CapsuleReport | null>(null);
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);

  useEffect(() => {
    getKV<CapsuleReport | null>("capsule", null).then(setReport);
  }, []);

  const build = async () => {
    if (!profile || !items) return;
    const label = custom.trim() || CAPSULE_GOALS.find((g) => g.id === goal)!.label;
    setBusy(true);
    try {
      const r = ai
        ? await api.capsule({ goal: label, profile, items: items.filter((i) => i.status === "active").map(toBrief), trends: trendsDigest(await getTrends()) })
        : localCapsule(goal, label, items);
      setReport(r);
      await setKV("capsule", r);
    } catch (e) {
      toast(errorText(e), "error");
      setReport(localCapsule(goal, label, items));
    }
    setBusy(false);
  };

  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((x): x is WardrobeItem => !!x);

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap gap-1.5">
          {CAPSULE_GOALS.map((g) => (
            <button key={g.id} className={clsx("chip py-2", goal === g.id && !custom && "chip-on")} onClick={() => (setGoal(g.id), setCustom(""))}>
              {g.label}
            </button>
          ))}
        </div>
        <Field label="Или своя цель">
          <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Неделя в Питере в октябре, 3 деловых встречи и театр" />
        </Field>
        <button className="btn-primary" onClick={build} disabled={busy || !items?.length}>
          {busy ? <Spinner /> : <Sparkles size={16} />} Собрать капсулу
        </button>
      </div>

      {report && (
        <>
          <div className="card p-5">
            <div className="mb-2 flex items-center gap-2">
              <AiBadge source={report.source} />
              <span className="text-sm font-bold">{report.goal}</span>
            </div>
            <p className="text-sm text-muted">{report.summary}</p>
            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
              {pick(report.capsuleItemIds).map((i) => (
                <ItemThumb key={i.id} item={i} className="aspect-square w-full" />
              ))}
            </div>
          </div>
          {report.combos.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-bold">Сочетания</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {report.combos.map((c, i) => (
                  <div key={i} className="card p-3">
                    <OutfitCollage items={pick(c.itemIds)} className="min-h-40" />
                    <div className="mt-2 text-sm font-semibold">{c.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {report.gaps.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-lg font-bold">Что докупить</h3>
              <div className="space-y-2">
                {report.gaps.map((g, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
                    <span className={clsx("h-2.5 w-2.5 rounded-full", g.priority === "high" ? "bg-bad" : g.priority === "medium" ? "bg-warn" : "bg-ok")} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{g.item}</div>
                      <div className="text-xs text-muted">
                        {g.why}
                        {g.budgetRub ? ` · до ${g.budgetRub.toLocaleString("ru-RU")} ₽` : ""}
                      </div>
                    </div>
                    <button className="btn-ghost py-1.5 text-xs" onClick={() => onSearch(g.query)}>
                      <Search size={14} /> Найти
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ShopSearch({ initial }: { initial: string }) {
  const profile = useProfile();
  const ai = useUI((s) => s.health?.ai);
  const [q, setQ] = useState(initial);
  const [budget, setBudget] = useState("");
  const [useAi, setUseAi] = useState(true);
  const [res, setRes] = useState<ShopResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!profile || !q.trim()) return;
    setBusy(true);
    try {
      setRes(await api.shop({ query: q.trim(), profile, budget: budget || undefined, useAi: useAi && ai }));
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(false);
  };
  useEffect(() => {
    if (initial) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-5">
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-60 flex-1" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Например: бежевый тренч миди, лоферы на тракторной подошве" />
          <input className="input w-40" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Бюджет, ₽" />
          <button className="btn-primary" onClick={run} disabled={busy}>
            {busy ? <Spinner /> : <Search size={16} />} Искать
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {profile && (
            <span>
              Ваши размеры: одежда {profile.sizes.top}/{profile.sizes.bottom} RU ({profile.sizes.international}), обувь {profile.sizes.shoes}
            </span>
          )}
          <button className={clsx("chip", useAi && ai && "chip-on")} onClick={() => setUseAi(!useAi)} disabled={!ai}>
            ✦ Подбор товаров через Claude {ai ? "" : "(нужен ключ)"}
          </button>
        </div>
      </div>

      {busy && useAi && ai && <div className="card p-5 text-sm text-muted">Claude ищет товары на Wildberries, Ozon, Lamoda и сайтах брендов…</div>}

      {res && (
        <>
          <div className="card p-5">
            <div className="mb-3 text-sm font-bold">Открыть поиск в магазинах (с вашим размером)</div>
            <div className="flex flex-wrap gap-2">
              {res.links.map((l) => (
                <a key={l.shop} href={l.url} target="_blank" rel="noreferrer" className="btn-ghost">
                  {l.shop} <ExternalLink size={14} />
                </a>
              ))}
            </div>
          </div>
          {res.note && <div className="rounded-3xl bg-surface-2 p-4 text-sm">{res.note}</div>}
          {res.products.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {res.products.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer" className="card flex flex-col gap-2 p-4 transition hover:-translate-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="chip py-0.5">{p.shop}</span>
                    {p.price && <span className="font-bold">{p.price}</span>}
                  </div>
                  <div className="font-semibold">{p.title}</div>
                  {p.why && <p className="text-xs text-muted">{p.why}</p>}
                  <span className="mt-auto flex items-center gap-1 text-xs font-bold text-accent">
                    Открыть <ExternalLink size={12} />
                  </span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
