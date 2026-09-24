import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { ImagePlus, Send, Square, Trash2, X } from "lucide-react";
import { EVENT_TYPES, toBrief } from "@shared/catalog";
import type { ChatMessage } from "@shared/types";
import { streamChat } from "../api";
import { Markdown, PageHeader, Spinner } from "../components/ui";
import { db, uid, useEvents, useItems, useProfile } from "../db";
import { daysBetween, formatDay, todayISO, tomorrowISO } from "../lib/dates";
import { useWeather } from "../lib/hooks";
import { fileToDataUrl, resizeImage } from "../lib/image";
import { errorText, useUI } from "../store";

const QUICK = [
  "Что надеть завтра на работу?",
  "Какие вещи из моего гардероба сейчас в тренде?",
  "Собери 5 образов на неделю без повторов",
  "Чего не хватает моему гардеробу этой осенью?",
  "Какие цвета мне идут с моим подтоном?",
  "Как носить мой пиджак по-новому?",
];

export default function Chat() {
  const profile = useProfile();
  const items = useItems();
  const events = useEvents();
  const ai = useUI((s) => s.health?.ai);
  const messages = useLiveQuery(() => db.chat.orderBy("createdAt").toArray(), []);
  const loc = useLocation() as { state?: { prompt?: string } };
  const [text, setText] = useState(loc.state?.prompt ?? "");
  const [image, setImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { weather } = useWeather(tomorrowISO());
  const { weather: todayWx } = useWeather(todayISO());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, streaming]);

  const send = async (t = text) => {
    if (!profile || !items || (!t.trim() && !image) || streaming !== null) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", text: t.trim(), image: image ?? undefined, createdAt: Date.now() };
    await db.chat.add(userMsg);
    setText("");
    setImage(null);
    const history = [...(messages ?? []), userMsg].slice(-16);
    const upcoming = (events ?? []).filter((e) => e.date >= todayISO() && daysBetween(todayISO(), e.date) <= 10);
    const context = [
      `Сегодня ${formatDay(todayISO())}.`,
      todayWx ? `Погода сегодня: ${todayWx.description}, ${Math.round(todayWx.tMin)}…${Math.round(todayWx.tMax)}°C.` : "",
      weather ? `Завтра: ${weather.description}, ${Math.round(weather.tMin)}…${Math.round(weather.tMax)}°C, осадки ${weather.precipProb}%, ветер ${Math.round(weather.windMax)} м/с.` : "",
      upcoming.length ? `Ближайшие события: ${upcoming.map((e) => `${e.date} ${e.start ?? ""} ${e.title} (${EVENT_TYPES[e.type].label}${e.dressCode ? `, дресс-код ${e.dressCode}` : ""})`).join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = "";
    setStreaming("");
    try {
      await streamChat(
        {
          messages: history.map((m) => ({ role: m.role, text: m.text, image: m.image })),
          profile,
          items: items.filter((i) => i.status === "active").map(toBrief),
          context,
        },
        (d) => {
          acc += d;
          setStreaming(acc);
        },
        ctrl.signal,
      );
    } catch (e) {
      if (!ctrl.signal.aborted) acc += `${acc ? "\n\n" : ""}_Ошибка: ${errorText(e)}_`;
    }
    if (acc) await db.chat.add({ id: uid(), role: "assistant", text: acc, createdAt: Date.now() });
    setStreaming(null);
  };

  if (!messages) return null;
  return (
    <div className="flex h-[calc(100dvh-170px)] flex-col lg:h-[calc(100dvh-80px)]">
      <PageHeader
        title="Чат со стилистом"
        subtitle="Спрашивайте что угодно: что надеть, с чем носить, что купить. Можно прикрепить фото."
        actions={
          messages.length > 0 && (
            <button className="btn-ghost" onClick={() => confirm("Очистить историю чата?") && db.chat.clear()}>
              <Trash2 size={16} /> Очистить
            </button>
          )
        }
      />
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && streaming === null && (
            <div className="mx-auto max-w-xl py-8 text-center">
              <div className="mb-2 font-display text-3xl font-semibold">Чем помочь?</div>
              <p className="mb-5 text-sm text-muted">Я знаю ваш гардероб, мерки, календарь и погоду.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK.map((q) => (
                  <button key={q} className="chip py-2" onClick={() => send(q)} disabled={!ai}>
                    {q}
                  </button>
                ))}
              </div>
              {!ai && <p className="mt-5 text-xs text-warn">Чат работает через Claude — добавьте ANTHROPIC_API_KEY в .env и перезапустите сервер.</p>}
            </div>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          {streaming !== null && (
            <div className="flex">
              <div className="max-w-[85%] rounded-3xl rounded-bl-lg bg-surface-2 px-4 py-3">
                {streaming ? <Markdown text={streaming} /> : <Spinner />}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-line p-3">
          {image && (
            <div className="relative mb-2 inline-block">
              <img src={image} alt="" className="h-20 rounded-2xl object-cover" />
              <button className="btn-icon absolute -top-2 -right-2 h-6 w-6" onClick={() => setImage(null)}>
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button className="btn-icon shrink-0" onClick={() => fileRef.current?.click()} aria-label="Фото">
              <ImagePlus size={18} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) setImage(await resizeImage(await fileToDataUrl(f), 1024));
              }}
            />
            <textarea
              className="input max-h-40 min-h-11 flex-1 resize-none"
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={ai ? "Спросите стилиста…" : "Чат недоступен без ключа Claude"}
              disabled={!ai}
            />
            {streaming !== null ? (
              <button className="btn-icon shrink-0" onClick={() => abortRef.current?.abort()} aria-label="Стоп">
                <Square size={16} />
              </button>
            ) : (
              <button className="btn-primary h-11 w-11 shrink-0 p-0" onClick={() => send()} disabled={!ai || (!text.trim() && !image)} aria-label="Отправить">
                <Send size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.role === "user";
  return (
    <div className={clsx("flex", mine && "justify-end")}>
      <div className={clsx("max-w-[85%] rounded-3xl px-4 py-3", mine ? "rounded-br-lg bg-accent/20" : "rounded-bl-lg bg-surface-2")}>
        {m.image && <img src={m.image} alt="" className="mb-2 max-h-60 rounded-2xl" />}
        {mine ? <div className="text-sm whitespace-pre-wrap">{m.text}</div> : <Markdown text={m.text} />}
      </div>
    </div>
  );
}
