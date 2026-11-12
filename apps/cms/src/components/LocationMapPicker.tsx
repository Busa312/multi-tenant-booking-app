import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import L from "leaflet";
// Leaflet's own layout rules (panes, tiles, controls). Imported here, not in
// index.css, so only the Locations chunk pays for them.
import "leaflet/dist/leaflet.css";
import { useI18n } from "../i18n/I18nContext.js";
import { Alert, Button, TextInput } from "./ui/index.js";
import type { IconName } from "../lib/iconNames.js";

export interface LatLng {
  lat: number;
  lng: number;
}

interface LocationMapPickerProps {
  /** The pinned spot, or null for none (the map link then searches by address). */
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
  /** Pre-fills the search box — the address typed above the map. */
  initialQuery: string;
}

interface SearchResult {
  label: string;
  at: LatLng;
}

// Where the map opens when there's no pin and the browser won't say where the
// user is. The platform's tenants are Georgian salons (prices are in ₾), so
// Tbilisi is the useful default rather than a world view.
const FALLBACK_CENTER: LatLng = { lat: 41.7151, lng: 44.8271 };
const CITY_ZOOM = 12;
const STREET_ZOOM = 17;

// OpenStreetMap: tiles, and Nominatim for address search. Free and keyless;
// the usage policies ask for attribution (shown on the map) and no
// search-as-you-type, so search runs only when asked.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const SEARCH_URL = "https://nominatim.openstreetmap.org/search";

// Markers are HTML, styled with the theme's semantic colors like everything else.
// Raw HTML, not <Icon>, so the glyph is typed here: the icon font only holds
// the names in lib/iconNames.ts.
const PIN_GLYPH: IconName = "location_on";
const PIN_ICON = L.divIcon({
  className: "",
  // Filled glyph; written so the class reaches Tailwind's scanner exactly as rendered.
  html: `<span class='ms block text-[40px] leading-none text-primary drop-shadow-md [font-variation-settings:"FILL"_1]'>${PIN_GLYPH}</span>`,
  iconSize: [40, 40],
  iconAnchor: [20, 38],
});
const YOU_ICON = L.divIcon({
  className: "",
  html: `<span class='block size-4 rounded-full border-2 border-base-100 bg-info shadow-md ring-4 ring-info/25'></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const toLatLng = (point: L.LatLng): LatLng => {
  const wrapped = point.wrap();
  return { lat: round6(wrapped.lat), lng: round6(wrapped.lng) };
};

/**
 * The branch's spot on a map: search an address, click or drag to place the
 * pin, or use where you are now. Replaces typing latitude and longitude.
 */
export function LocationMapPicker({ value, onChange, initialQuery }: LocationMapPickerProps) {
  const { t, lang } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const you = useRef<L.Marker | null>(null);
  // Handlers are bound once, when the map is made; they read the latest
  // callback from here rather than the one from the first render.
  const changed = useRef(onChange);
  changed.current = onChange;

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const showYou = (at: LatLng) => {
    if (!map.current) return;
    if (you.current) you.current.setLatLng(at);
    // Not interactive: it often sits right on the pin, and must never catch a drag meant for it.
    else
      you.current = L.marker(at, { icon: YOU_ICON, title: t("locations.mapYouAreHere"), keyboard: false, interactive: false }).addTo(
        map.current,
      );
  };

  // Where the user is, via the browser. `pinIt` = also move the branch pin there.
  const locate = (pinIt: boolean) => {
    if (!("geolocation" in navigator)) {
      if (pinIt) setProblem(t("locations.mapLocationDenied"));
      return;
    }
    setLocating(pinIt);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const at = { lat: round6(position.coords.latitude), lng: round6(position.coords.longitude) };
        showYou(at);
        map.current?.setView(at, pinIt ? STREET_ZOOM : Math.max(map.current.getZoom(), 15));
        if (pinIt) {
          setProblem(null);
          changed.current(at);
        }
      },
      () => {
        setLocating(false);
        // Asked for on open too; a refusal there is the user's answer, not an error.
        if (pinIt) setProblem(t("locations.mapLocationDenied"));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  // The map, made once.
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      center: value ?? FALLBACK_CENTER,
      zoom: value ? STREET_ZOOM : CITY_ZOOM,
      scrollWheelZoom: true,
    });
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(instance);
    instance.on("click", (event: L.LeafletMouseEvent) => changed.current(toLatLng(event.latlng)));
    map.current = instance;

    // The modal opens after its children mount, so the map first measures a
    // zero-size box; re-measure whenever the box actually changes.
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(container.current);

    // No pin yet: start where the user is, if the browser will say.
    if (!value) locate(false);

    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      pin.current = null;
      you.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The pin follows `value`.
  useEffect(() => {
    if (!map.current) return;
    if (!value) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (pin.current) {
      pin.current.setLatLng(value);
      return;
    }
    const marker = L.marker(value, {
      icon: PIN_ICON,
      draggable: true,
      title: t("locations.mapPin"),
      autoPan: true,
      // Above the "you are here" dot, whichever was added last.
      zIndexOffset: 1000,
    });
    marker.on("dragend", () => changed.current(toLatLng(marker.getLatLng())));
    marker.addTo(map.current);
    pin.current = marker;
  }, [value, t]);

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setProblem(null);
    setResults(null);
    try {
      const params = new URLSearchParams({ q, format: "jsonv2", limit: "5", "accept-language": lang });
      // Prefer places near what's on screen, without excluding the rest.
      const bounds = map.current?.getBounds();
      if (bounds) params.set("viewbox", bounds.toBBoxString());
      const response = await fetch(`${SEARCH_URL}?${params.toString()}`);
      if (!response.ok) throw new Error(String(response.status));
      const rows = (await response.json()) as { lat: string; lon: string; display_name: string }[];
      setResults(
        rows
          .map((row) => ({ label: row.display_name, at: { lat: round6(Number(row.lat)), lng: round6(Number(row.lon)) } }))
          .filter((row) => Number.isFinite(row.at.lat) && Number.isFinite(row.at.lng)),
      );
    } catch {
      setProblem(t("locations.mapSearchFailed"));
    } finally {
      setSearching(false);
    }
  };

  const pick = (result: SearchResult) => {
    setResults(null);
    changed.current(result.at);
    map.current?.setView(result.at, STREET_ZOOM);
  };

  // Enter searches here instead of submitting the location form around it.
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void search();
    }
  };

  return (
    <div className="mb-4 flex flex-col gap-2">
      <p className="text-sm font-medium">{t("locations.mapLabel")}</p>

      <div className="join w-full">
        <TextInput
          className="join-item min-w-0 flex-1"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKey}
          placeholder={t("locations.mapSearchPlaceholder")}
          aria-label={t("locations.mapSearchPlaceholder")}
        />
        <Button type="button" variant="secondary" className="join-item" onClick={() => void search()} disabled={searching}>
          {searching ? t("locations.mapSearching") : t("locations.mapSearch")}
        </Button>
      </div>

      {results && (
        <ul className="menu w-full rounded-box border border-base-300 bg-base-100 p-1">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-base-content/60">{t("locations.mapNoResults")}</li>
          ) : (
            results.map((result) => (
              <li key={`${result.at.lat},${result.at.lng},${result.label}`}>
                <button type="button" className="text-left text-sm" onClick={() => pick(result)}>
                  {result.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      <div
        ref={container}
        className="z-0 h-72 w-full overflow-hidden rounded-box border border-base-300 bg-base-200"
        role="application"
        aria-label={t("locations.mapLabel")}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" icon="my_location" onClick={() => locate(true)} disabled={locating}>
          {locating ? t("locations.mapLocating") : t("locations.mapUseMyLocation")}
        </Button>
        {value && (
          <Button type="button" variant="secondary" size="sm" icon="location_off" onClick={() => changed.current(null)}>
            {t("locations.mapRemovePin")}
          </Button>
        )}
        <span className="ml-auto text-xs tabular-nums text-base-content/55">
          {value ? `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}` : t("locations.mapNoPin")}
        </span>
      </div>
      <p className="text-xs text-base-content/55">{t("locations.mapHint")}</p>

      {problem && (
        <Alert variant="warning" flush>
          {problem}
        </Alert>
      )}
    </div>
  );
}
