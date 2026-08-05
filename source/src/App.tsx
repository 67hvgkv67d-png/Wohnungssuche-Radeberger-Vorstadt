"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { type Wohnung, type Wohnungsdaten } from "./types";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const decimal = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormat = new Intl.DateTimeFormat("de-DE");

const bezugspunkt = {
  name: "Bezugspunkt",
  adresse: "Auf dem Meisenberg 19, 01099 Dresden",
  breitengrad: 51.0691724,
  laengengrad: 13.7809786,
} as const;

type ViewMode = "aktiv" | "ausgeblendet";
type SortMode = "distanz" | "miete-auf" | "miete-ab" | "neu";
type RoomsFilter = "alle" | "2" | "3";
type SuitabilityFilter = "alle" | Wohnung["wg_eignung"];

function ageLabel(date: string) {
  const firstSeen = new Date(`${date}T12:00:00`);
  if (Number.isNaN(firstSeen.getTime())) return null;

  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const firstSeenUtc = Date.UTC(
    firstSeen.getFullYear(),
    firstSeen.getMonth(),
    firstSeen.getDate(),
  );
  const days = Math.max(
    0,
    Math.round((todayUtc - firstSeenUtc) / (24 * 60 * 60 * 1000)),
  );

  if (days === 0) return "Heute hinzugefügt";
  if (days === 1) return "Seit 1 Tag erfasst";
  return `Seit ${days} Tagen erfasst`;
}

function rentLabel(value: number | null, display?: string) {
  if (display) return display;
  return value === null ? "nicht angegeben" : euro.format(value);
}

function walkingLabel(wohnung: Wohnung) {
  if (!wohnung.fussweg) return "nicht verlässlich berechenbar";
  const prefix = wohnung.fussweg.genauigkeit === "ungefähr" ? "ca. " : "";
  const distance =
    wohnung.fussweg.distanz_m < 1000
      ? `${wohnung.fussweg.distanz_m} m`
      : `${decimal.format(wohnung.fussweg.distanz_m / 1000)} km`;
  return `${prefix}${wohnung.fussweg.dauer_min} Min. · ${distance}`;
}

function suitabilityClass(value: Wohnung["wg_eignung"]) {
  return value === "ausdrücklich genannt" ? "status-good" : "status-maybe";
}

function OverviewMap({ wohnungen }: { wohnungen: Wohnung[] }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mappedWohnungen = useMemo(
    () => wohnungen.filter((wohnung) => wohnung.kartenposition),
    [wohnungen],
  );
  const unmappedCount = wohnungen.length - mappedWohnungen.length;

  useEffect(() => {
    if (!mapElement.current) return;

    const map = L.map(mapElement.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>',
      maxZoom: 19,
    }).addTo(map);

    const bounds: L.LatLngExpression[] = [];

    mappedWohnungen.forEach((wohnung) => {
      const position = wohnung.kartenposition;
      if (!position) return;
      const markerPosition: L.LatLngTuple = [
        position.breitengrad,
        position.laengengrad,
      ];
      const marker = L.marker(markerPosition, {
        icon: L.divIcon({
          className: "map-marker overview-marker overview-marker-home",
          html: "<span>W</span>",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -18],
        }),
        title: wohnung.titel,
      }).addTo(map);

      const popup = document.createElement("div");
      popup.className = "overview-popup";
      const title = document.createElement("strong");
      title.textContent = wohnung.titel;
      const address = document.createElement("span");
      address.textContent = wohnung.adresse;
      const walking = document.createElement("span");
      walking.textContent = `Fußweg: ${walkingLabel(wohnung)}`;
      const link = document.createElement("a");
      link.href = wohnung.direkte_inserats_url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Direktes Inserat öffnen ↗";
      popup.append(title, address, walking, link);
      marker.bindPopup(popup);
      bounds.push(markerPosition);
    });

    const referencePosition: L.LatLngTuple = [
      bezugspunkt.breitengrad,
      bezugspunkt.laengengrad,
    ];
    const referenceMarker = L.marker(referencePosition, {
      icon: L.divIcon({
        className: "map-marker overview-marker overview-marker-reference",
        html: "<span>Z</span>",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -21],
      }),
      title: `${bezugspunkt.name}: ${bezugspunkt.adresse}`,
    }).addTo(map);

    const referencePopup = document.createElement("div");
    referencePopup.className = "overview-popup";
    const referenceName = document.createElement("strong");
    referenceName.textContent = bezugspunkt.name;
    const referenceAddress = document.createElement("span");
    referenceAddress.textContent = bezugspunkt.adresse;
    referencePopup.append(referenceName, referenceAddress);
    referenceMarker.bindPopup(referencePopup);
    bounds.push(referencePosition);

    map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 15 });

    return () => {
      map.remove();
    };
  }, [mappedWohnungen]);

  return (
    <article className="overview-map-card overview-map-card-single">
      <div className="overview-map-heading">
        <div>
          <p>Radeberger Vorstadt</p>
          <h3>
            {mappedWohnungen.length} {mappedWohnungen.length === 1 ? "Wohnung" : "Wohnungen"} kartiert
          </h3>
        </div>
        <span>Z = {bezugspunkt.adresse}</span>
      </div>
      <div
        ref={mapElement}
        className="overview-map-canvas overview-map-canvas-large"
        aria-label={`Karte mit ${mappedWohnungen.length} Wohnungen und dem Bezugspunkt ${bezugspunkt.adresse}`}
      />
      <div className="overview-map-meta">
        <p>
          <strong>{bezugspunkt.name}</strong>
          <span>{bezugspunkt.adresse}</span>
        </p>
        {unmappedCount > 0 ? (
          <p className="overview-map-warning">
            Für {unmappedCount} {unmappedCount === 1 ? "Angebot" : "Angebote"} ist keine verlässliche Lage veröffentlicht.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function LocationMap({ wohnung }: { wohnung: Wohnung }) {
  const [isOpen, setIsOpen] = useState(false);
  const mapElement = useRef<HTMLDivElement>(null);
  const position = wohnung.kartenposition;

  useEffect(() => {
    if (!isOpen || !mapElement.current || !position) return;
    const wohnungPosition: L.LatLngTuple = [
      position.breitengrad,
      position.laengengrad,
    ];
    const referencePosition: L.LatLngTuple = [
      bezugspunkt.breitengrad,
      bezugspunkt.laengengrad,
    ];
    const map = L.map(mapElement.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>',
      maxZoom: 19,
    }).addTo(map);

    const homeIcon = L.divIcon({
      className: "map-marker map-marker-home overview-marker-home",
      html: "<span>W</span>",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const referenceIcon = L.divIcon({
      className: "map-marker map-marker-office overview-marker-reference",
      html: "<span>Z</span>",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    L.marker(wohnungPosition, { icon: homeIcon, title: wohnung.adresse }).addTo(map);
    L.marker(referencePosition, {
      icon: referenceIcon,
      title: bezugspunkt.adresse,
    }).addTo(map);
    L.polyline([wohnungPosition, referencePosition], {
      color: "#156b4c",
      weight: 2,
      opacity: 0.6,
      dashArray: "7 7",
    }).addTo(map);
    map.fitBounds(L.latLngBounds([wohnungPosition, referencePosition]), {
      padding: [34, 34],
      maxZoom: 16,
    });
    return () => {
      map.remove();
    };
  }, [isOpen, position, wohnung.adresse]);

  if (!position) {
    return (
      <div className="map-unavailable">
        Lage und Fußweg konnten nicht zuverlässig bestimmt werden.
      </div>
    );
  }

  const routeLink =
    "https://www.google.com/maps/dir/?api=1" +
    `&origin=${position.breitengrad},${position.laengengrad}` +
    `&destination=${bezugspunkt.breitengrad},${bezugspunkt.laengengrad}` +
    "&travelmode=walking";

  return (
    <div className="location-map">
      <button
        type="button"
        className="map-toggle"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? "Karte schließen" : "Lage und Fußweg anzeigen"}
        <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen ? (
        <div className="map-content">
          <div
            ref={mapElement}
            className="map-canvas"
            aria-label={`Karte mit ${wohnung.adresse} und ${bezugspunkt.adresse}`}
          />
          <div className="map-legend">
            <p>
              <span className="legend-marker overview-marker-home">W</span>
              <strong>Wohnung</strong>
              <small>{wohnung.adresse} · {position.genauigkeit}</small>
            </p>
            <p>
              <span className="legend-marker overview-marker-reference">Z</span>
              <strong>{bezugspunkt.name}</strong>
              <small>{bezugspunkt.adresse}</small>
            </p>
          </div>
          <div className="map-footer">
            <span>Fußweg: {walkingLabel(wohnung)}</span>
            <a href={routeLink} target="_blank" rel="noreferrer">
              Route öffnen ↗
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContactPanel({ wohnung }: { wohnung: Wohnung }) {
  const kontakt = wohnung.kontakt;

  return (
    <section className={`contact-panel ${kontakt.paywall ? "contact-panel-paywall" : ""}`}>
      <div className="contact-panel-heading">
        <h4>Kontakt</h4>
        {kontakt.paywall ? (
          <span>ImmoScout-Mieternetzwerk · Paywall</span>
        ) : (
          <span>direkt erreichbar</span>
        )}
      </div>
      <p className="contact-name">
        <strong>{kontakt.person ?? kontakt.organisation ?? "Anbieter:in"}</strong>
        {kontakt.person && kontakt.organisation ? ` · ${kontakt.organisation}` : null}
      </p>
      <p className="contact-way">
        {kontakt.paywall
          ? "Kontaktaufnahme nur über das ImmoScout-Mieternetzwerk; ein normales ImmoScout-Konto reicht dafür nicht aus."
          : `Kontaktweg: ${kontakt.weg}`}
      </p>
      <div className="contact-details">
        {kontakt.telefon ? (
          <a href={`tel:${kontakt.telefon.replace(/\s/g, "")}`}>{kontakt.telefon}</a>
        ) : null}
        {kontakt.email ? <a href={`mailto:${kontakt.email}`}>{kontakt.email}</a> : null}
        <a href={kontakt.url} target="_blank" rel="noreferrer">
          {kontakt.paywall ? "Kontakt im Mieternetzwerk öffnen ↗" : "Kontakt öffnen ↗"}
        </a>
      </div>
      {kontakt.alternativ_hinweis ? (
        <p className="alternative-contact-note">{kontakt.alternativ_hinweis}</p>
      ) : null}
    </section>
  );
}

function ListingCard({
  wohnung,
  isSaved,
  isHidden,
  note,
  onToggleSaved,
  onToggleHidden,
  onNoteChange,
}: {
  wohnung: Wohnung;
  isSaved: boolean;
  isHidden: boolean;
  note: string;
  onToggleSaved: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
}) {
  const age = ageLabel(wohnung.erstmals_gefunden_am);

  return (
    <article className={`listing-card listing-card-radeberger ${isSaved ? "listing-card-saved" : ""}`}>
      <div className="card-topline">
        <div className="card-labels">
          <span className="district-label">Radeberger Vorstadt</span>
          {wohnung.neu ? <span className="new-badge">Neu seit letztem Lauf</span> : null}
          {age ? <span className="age-badge">{age}</span> : null}
        </div>
        <span className={`status-badge ${suitabilityClass(wohnung.wg_eignung)}`}>
          {wohnung.wg_eignung === "ausdrücklich genannt"
            ? "WG ausdrücklich genannt"
            : "Grundriss prüfen"}
        </span>
      </div>

      <div className="card-heading">
        <p className="listing-id">{wohnung.id}</p>
        <h3>{wohnung.titel}</h3>
        <p className="address">{wohnung.adresse}</p>
      </div>

      <dl className="quick-facts quick-facts-five">
        <div>
          <dt>Zimmer</dt>
          <dd>{decimal.format(wohnung.zimmer)}</dd>
        </div>
        <div>
          <dt>Wohnfläche</dt>
          <dd>{decimal.format(wohnung.wohnflaeche_m2)} m²</dd>
        </div>
        <div>
          <dt>Nettokalt</dt>
          <dd>{rentLabel(wohnung.nettokaltmiete_eur, wohnung.nettokaltmiete_anzeige)}</dd>
        </div>
        <div>
          <dt>Warm</dt>
          <dd>{rentLabel(wohnung.warmmiete_eur, wohnung.warmmiete_anzeige)}</dd>
        </div>
        <div className="walking-fact">
          <dt>Fußweg zum Bezugspunkt</dt>
          <dd>{walkingLabel(wohnung)}</dd>
        </div>
      </dl>

      <div className="listing-summary">
        <p><strong>Verfügbar:</strong> {wohnung.verfuegbar_ab}</p>
        <p><strong>Einordnung:</strong> {wohnung.eignungshinweis}</p>
        <p><strong>Status:</strong> aktuell geprüft · kein Tauschangebot</p>
      </div>

      {wohnung.hinweis ? <p className="listing-note">{wohnung.hinweis}</p> : null}

      <ContactPanel wohnung={wohnung} />

      <LocationMap wohnung={wohnung} />

      <div className="provider-row">
        <span>{wohnung.anbieter} · {wohnung.quelle}</span>
        <span>geprüft {dateFormat.format(new Date(`${wohnung.abrufdatum}T12:00:00`))}</span>
      </div>

      <div className="card-actions">
        <label className="save-control">
          <input
            type="checkbox"
            checked={isSaved}
            onChange={() => onToggleSaved(wohnung.id)}
          />
          <span aria-hidden="true">{isSaved ? "✓" : ""}</span>
          {isSaved ? "Favorit" : "Als Favorit"}
        </label>
        <button className="hide-button" type="button" onClick={() => onToggleHidden(wohnung.id)}>
          {isHidden ? "Wieder anzeigen" : "Ausblenden"}
        </button>
      </div>

      <details className="note-box" open={note ? true : undefined}>
        <summary>{note ? "Persönliche Notiz bearbeiten" : "Notiz hinzufügen"}</summary>
        <label>
          <span>Persönliche Notiz</span>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(wohnung.id, event.target.value)}
            placeholder="Zum Beispiel: Besichtigung anfragen oder Rückruf ausstehend"
            rows={3}
          />
        </label>
        <p>Die Notiz wird nur in diesem Browser gespeichert.</p>
      </details>

      <a
        className="listing-link"
        href={wohnung.direkte_inserats_url}
        target="_blank"
        rel="noreferrer"
      >
        Direkt zum Inserat <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

export default function App() {
  const [daten, setDaten] = useState<Wohnungsdaten>({
    aktualisiert_am: "",
    bezugspunkt: bezugspunkt.adresse,
    wohnungen: [],
  });
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [rooms, setRooms] = useState<RoomsFilter>("alle");
  const [suitability, setSuitability] = useState<SuitabilityFilter>("alle");
  const [sort, setSort] = useState<SortMode>("distanz");
  const [view, setView] = useState<ViewMode>("aktiv");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const wohnungen = daten.wohnungen;

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}wohnungen.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Wohnungsdaten konnten nicht geladen werden.");
        return response.json() as Promise<Wohnungsdaten>;
      })
      .then(setDaten)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    try {
      setSavedIds(new Set(JSON.parse(localStorage.getItem("radeberger-saved") ?? "[]")));
      setHiddenIds(new Set(JSON.parse(localStorage.getItem("radeberger-hidden") ?? "[]")));
      const storedNotes = JSON.parse(localStorage.getItem("radeberger-notes") ?? "{}");
      setNotes(storedNotes && typeof storedNotes === "object" && !Array.isArray(storedNotes) ? storedNotes : {});
    } catch {
      setSavedIds(new Set());
      setHiddenIds(new Set());
      setNotes({});
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("radeberger-saved", JSON.stringify([...savedIds]));
    localStorage.setItem("radeberger-hidden", JSON.stringify([...hiddenIds]));
    localStorage.setItem("radeberger-notes", JSON.stringify(notes));
  }, [savedIds, hiddenIds, hydrated, notes]);

  useEffect(() => {
    if (!hydrated || wohnungen.length === 0) return;
    const validIds = new Set(wohnungen.map((wohnung) => wohnung.id));
    setSavedIds((current) => new Set([...current].filter((id) => validIds.has(id))));
    setHiddenIds((current) => new Set([...current].filter((id) => validIds.has(id))));
    setNotes((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => validIds.has(id))),
    );
  }, [hydrated, wohnungen]);

  const threeRoomCount = wohnungen.filter((wohnung) => wohnung.zimmer === 3).length;
  const explicitWgCount = wohnungen.filter(
    (wohnung) => wohnung.wg_eignung === "ausdrücklich genannt",
  ).length;
  const nearbyCount = wohnungen.filter(
    (wohnung) => wohnung.fussweg && wohnung.fussweg.distanz_m <= 1000,
  ).length;

  const visibleWohnungen = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("de-DE");
    return wohnungen
      .filter((wohnung) =>
        view === "ausgeblendet" ? hiddenIds.has(wohnung.id) : !hiddenIds.has(wohnung.id),
      )
      .filter((wohnung) => rooms === "alle" || wohnung.zimmer === Number(rooms))
      .filter(
        (wohnung) => suitability === "alle" || wohnung.wg_eignung === suitability,
      )
      .filter((wohnung) => {
        if (!search) return true;
        return [
          wohnung.titel,
          wohnung.adresse,
          wohnung.anbieter,
          wohnung.quelle,
          wohnung.id,
          wohnung.eignungshinweis,
          wohnung.hinweis ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("de-DE")
          .includes(search);
      })
      .sort((a, b) => {
        if (sort === "miete-auf")
          return (a.nettokaltmiete_eur ?? Number.MAX_SAFE_INTEGER) -
            (b.nettokaltmiete_eur ?? Number.MAX_SAFE_INTEGER);
        if (sort === "miete-ab")
          return (b.nettokaltmiete_eur ?? -1) - (a.nettokaltmiete_eur ?? -1);
        if (sort === "neu")
          return b.erstmals_gefunden_am.localeCompare(a.erstmals_gefunden_am);
        return (a.fussweg?.distanz_m ?? Number.MAX_SAFE_INTEGER) -
          (b.fussweg?.distanz_m ?? Number.MAX_SAFE_INTEGER);
      });
  }, [hiddenIds, query, rooms, sort, suitability, view, wohnungen]);

  function updateSet(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetFilters() {
    setQuery("");
    setRooms("alle");
    setSuitability("alle");
    setSort("distanz");
  }

  function updateNote(id: string, note: string) {
    setNotes((current) => {
      const next = { ...current };
      if (note) next[id] = note;
      else delete next[id];
      return next;
    });
  }

  function downloadCsv() {
    const headers = [
      "ID", "Titel", "Adresse", "Zimmer", "Wohnfläche m²", "Nettokaltmiete €",
      "Warmmiete €", "Fußweg Meter", "Fußweg Minuten", "WG-Eignung", "Verfügbar",
      "Anbieter", "Quelle", "Kontaktperson", "Kontaktweg", "Telefon", "E-Mail",
      "Kontakt-URL", "Paywall", "Direkte Inserats-URL", "Abrufdatum", "Favorit",
      "Ausgeblendet", "Persönliche Notiz",
    ];
    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = wohnungen.map((wohnung) => [
      wohnung.id,
      wohnung.titel,
      wohnung.adresse,
      decimal.format(wohnung.zimmer),
      decimal.format(wohnung.wohnflaeche_m2),
      wohnung.nettokaltmiete_eur ?? "nicht angegeben",
      wohnung.warmmiete_eur ?? "nicht angegeben",
      wohnung.fussweg?.distanz_m ?? "nicht berechenbar",
      wohnung.fussweg?.dauer_min ?? "nicht berechenbar",
      wohnung.wg_eignung,
      wohnung.verfuegbar_ab,
      wohnung.anbieter,
      wohnung.quelle,
      wohnung.kontakt.person ?? wohnung.kontakt.organisation ?? "",
      wohnung.kontakt.weg,
      wohnung.kontakt.telefon ?? "",
      wohnung.kontakt.email ?? "",
      wohnung.kontakt.url,
      wohnung.kontakt.paywall ? "ja" : "nein",
      wohnung.direkte_inserats_url,
      wohnung.abrufdatum,
      savedIds.has(wohnung.id) ? "ja" : "nein",
      hiddenIds.has(wohnung.id) ? "ja" : "nein",
      notes[wohnung.id] ?? "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wohnungssuche-radeberger-vorstadt-${daten.aktualisiert_am || "aktuell"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="hero-date">
            Stand {daten.aktualisiert_am ? dateFormat.format(new Date(`${daten.aktualisiert_am}T12:00:00`)) : "wird geladen"}
          </p>
          <p className="eyebrow">Wohnungssuche für zwei Personen</p>
          <h1>Wohnungen in der Radeberger Vorstadt</h1>
        </div>
        <aside className="hero-panel" aria-label="Übersicht">
          <p className="panel-kicker">Aktueller Überblick</p>
          <div className="hero-stat-primary">
            <strong>{wohnungen.length}</strong>
            <span>aktive Direktangebote</span>
          </div>
          <div className="hero-stat-grid">
            <div><strong>{threeRoomCount}</strong><span>mit 3 Zimmern</span></div>
            <div><strong>{wohnungen.length - threeRoomCount}</strong><span>mit 2 Zimmern</span></div>
            <div><strong>{explicitWgCount}</strong><span>ausdrücklich WG-geeignet</span></div>
            <div><strong>{nearbyCount}</strong><span>bis 1 km Fußweg</span></div>
          </div>
          <p className="panel-note">
            2–3 Zimmer · höchstens 900 € Nettokaltmiete · Aktualisierung montags und mittwochs um 9:00 Uhr
          </p>
        </aside>
      </section>

      <section className="overview-section" aria-labelledby="karten-ueberschrift">
        <div className="overview-section-heading">
          <div>
            <p className="eyebrow eyebrow-dark">Lage im Stadtteil</p>
            <h2 id="karten-ueberschrift">Alle Wohnungen auf einen Blick</h2>
          </div>
          <p>
            Die Karte zeigt die gefundenen Wohnungen und den Bezugspunkt Auf dem Meisenberg 19. Fußwege werden aus veröffentlichten Lageangaben berechnet.
          </p>
        </div>
        <div className="overview-map-grid overview-map-grid-single">
          <OverviewMap wohnungen={wohnungen} />
        </div>
        <div className="overview-map-legend" aria-label="Kartenlegende">
          <span><i className="overview-legend-dot overview-marker-home">W</i>Wohnung</span>
          <span><i className="overview-legend-dot overview-marker-reference">Z</i>Bezugspunkt</span>
        </div>
        <p className="overview-map-note">
          Bei unvollständigen Adressen ist die Lage nur ungefähr oder nicht kartiert. Beim Laden werden Kartendaten von OpenStreetMap abgerufen.
        </p>
      </section>

      <section className="content-section" id="angebote">
        {loadError ? (
          <div className="accessibility-note" role="alert">
            <span className="note-icon" aria-hidden="true">!</span>
            <div><strong>Die Angebotsdaten konnten nicht geladen werden.</strong><p>Bitte die Seite neu laden.</p></div>
          </div>
        ) : null}
        <div className="section-heading">
          <div>
            <p className="eyebrow eyebrow-dark">Aktive Direktangebote</p>
            <h2>Wohnungen filtern und vormerken</h2>
          </div>
          <p>
            Favoriten, ausgeblendete Angebote und persönliche Notizen bleiben auf diesem Gerät gespeichert.
          </p>
        </div>

        <div className="filter-panel" aria-label="Angebote filtern">
          <div className="view-tabs" role="group" aria-label="Ansicht wählen">
            <button type="button" className={view === "aktiv" ? "active" : ""} aria-pressed={view === "aktiv"} onClick={() => setView("aktiv")}>
              Aktive Liste <span>{wohnungen.length - hiddenIds.size}</span>
            </button>
            <button type="button" className={view === "ausgeblendet" ? "active" : ""} aria-pressed={view === "ausgeblendet"} onClick={() => setView("ausgeblendet")}>
              Ausgeblendet <span>{hiddenIds.size}</span>
            </button>
          </div>
          <div className="filter-grid filter-grid-compact">
            <label className="search-field">
              <span>Suche</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Adresse, Anbieter oder Titel …" />
            </label>
            <label>
              <span>Zimmer</span>
              <select value={rooms} onChange={(event) => setRooms(event.target.value as RoomsFilter)}>
                <option value="alle">2 und 3 Zimmer</option>
                <option value="2">2 Zimmer</option>
                <option value="3">3 Zimmer</option>
              </select>
            </label>
            <label>
              <span>WG-Eignung</span>
              <select value={suitability} onChange={(event) => setSuitability(event.target.value as SuitabilityFilter)}>
                <option value="alle">Alle Einordnungen</option>
                <option value="ausdrücklich genannt">ausdrücklich genannt</option>
                <option value="nach Grundriss prüfen">Grundriss prüfen</option>
              </select>
            </label>
            <label>
              <span>Sortierung</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
                <option value="distanz">kürzester Fußweg</option>
                <option value="miete-auf">Nettokaltmiete aufsteigend</option>
                <option value="miete-ab">Nettokaltmiete absteigend</option>
                <option value="neu">zuletzt gefunden</option>
              </select>
            </label>
          </div>
          <div className="filter-footer">
            <p aria-live="polite"><strong>{visibleWohnungen.length}</strong> {visibleWohnungen.length === 1 ? "Angebot" : "Angebote"} angezeigt{savedIds.size ? ` · ${savedIds.size} vorgemerkt` : ""}</p>
            <div>
              <button type="button" className="text-button" onClick={resetFilters}>Filter zurücksetzen</button>
              <button type="button" className="json-button" onClick={downloadCsv}>CSV für Excel herunterladen</button>
            </div>
          </div>
        </div>

        {visibleWohnungen.length ? (
          <div className="listing-grid">
            {visibleWohnungen.map((wohnung) => (
              <ListingCard
                key={wohnung.id}
                wohnung={wohnung}
                isSaved={savedIds.has(wohnung.id)}
                isHidden={hiddenIds.has(wohnung.id)}
                note={notes[wohnung.id] ?? ""}
                onToggleSaved={(id) => updateSet(setSavedIds, id)}
                onToggleHidden={(id) => updateSet(setHiddenIds, id)}
                onNoteChange={updateNote}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">0</span><h3>Keine passenden Angebote</h3>
            <p>Filter anpassen oder zur aktiven Liste wechseln.</p>
            <button type="button" onClick={resetFilters}>Filter zurücksetzen</button>
          </div>
        )}
      </section>

      <section className="method-section" id="methode">
        <p className="eyebrow">So wird gesucht</p>
        <div className="method-grid">
          <div><span>01</span><h2>Nur Zielgebiet</h2><p>Berücksichtigt werden ausschließlich Mietwohnungen in der Radeberger Vorstadt.</p></div>
          <div><span>02</span><h2>Passende Größe</h2><p>2 bis 3 Zimmer für zwei Personen und höchstens 900 € Nettokaltmiete.</p></div>
          <div><span>03</span><h2>Direkt geprüft</h2><p>Nur aktuell erreichbare Einzelangebote mit Kontaktweg. Keine Gesuche, Übersichtsseiten oder Tauschwohnungen.</p></div>
        </div>
      </section>

      <footer>
        <p>
          Recherche-Stand {daten.aktualisiert_am ? dateFormat.format(new Date(`${daten.aktualisiert_am}T12:00:00`)) : "wird geladen"} · Angaben ohne Gewähr · Verfügbarkeit bitte auf der Direktseite prüfen
        </p>
      </footer>
    </main>
  );
}
