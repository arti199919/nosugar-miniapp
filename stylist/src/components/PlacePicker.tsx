import { useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import type { Place } from "@shared/types";
import { api } from "../api";
import { errorText, toast } from "../store";
import { Spinner } from "./ui";

export function PlacePicker({ value, onChange, placeholder = "Адрес или место" }: { value?: Place; onChange: (p: Place | undefined) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      setResults(await api.geocode(q.trim()));
    } catch (e) {
      toast(errorText(e), "error");
    }
    setBusy(false);
  };

  const locate = () => {
    if (!navigator.geolocation) return toast("Геолокация недоступна", "error");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ label: "Моё местоположение", lat: pos.coords.latitude, lon: pos.coords.longitude });
        setBusy(false);
      },
      (err) => {
        toast(err.message, "error");
        setBusy(false);
      },
      { timeout: 10000 },
    );
  };

  if (value && results === null)
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-3 py-2 text-sm">
        <MapPin size={15} className="shrink-0 text-accent" />
        <span className="flex-1 truncate">{value.label}</span>
        <button type="button" className="text-xs font-bold text-muted hover:text-fg" onClick={() => (setResults([]), setQ(""))}>
          изменить
        </button>
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
        />
        <button type="button" className="btn-icon h-auto w-11 shrink-0" onClick={search} aria-label="Найти">
          {busy ? <Spinner /> : <Search size={16} />}
        </button>
        <button type="button" className="btn-icon h-auto w-11 shrink-0" onClick={locate} aria-label="Моё местоположение" title="Моё местоположение">
          <LocateFixed size={16} />
        </button>
      </div>
      {results && results.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line">
          {results.map((r) => (
            <button
              type="button"
              key={`${r.lat},${r.lon}`}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
              onClick={() => {
                onChange(r);
                setResults(null);
              }}
            >
              <MapPin size={14} className="shrink-0 text-muted" />
              {r.label}
            </button>
          ))}
        </div>
      )}
      {results && results.length === 0 && q && !busy && <p className="text-xs text-muted">Ничего не найдено — уточните запрос</p>}
      {value && (
        <button type="button" className="text-xs text-muted" onClick={() => setResults(null)}>
          Оставить «{value.label}»
        </button>
      )}
    </div>
  );
}
