export type Wohnung = {
  id: string;
  titel: string;
  adresse: string;
  zimmer: 2 | 3;
  wohnflaeche_m2: number;
  nettokaltmiete_eur: number | null;
  nettokaltmiete_anzeige?: string;
  warmmiete_eur: number | null;
  warmmiete_anzeige?: string;
  wg_eignung: "ausdrücklich genannt" | "nach Grundriss prüfen";
  eignungshinweis: string;
  verfuegbar_ab: string;
  anbieter: string;
  quelle: string;
  direkte_inserats_url: string;
  status: "aktiv geprüft";
  tauschwohnung: false;
  kontakt: {
    person?: string;
    organisation?: string;
    weg: "Telefon und E-Mail" | "Telefon und Kleinanzeigen-Nachricht" | "E-Mail und ImmoScout-Nachricht" | "Kleinanzeigen-Nachricht" | "ImmoScout-Mieternetzwerk";
    telefon?: string;
    email?: string;
    url: string;
    paywall: boolean;
    alternativ_hinweis?: string;
  };
  abrufdatum: string;
  erstmals_gefunden_am: string;
  kartenposition?: {
    breitengrad: number;
    laengengrad: number;
    genauigkeit: "Adresse gefunden" | "ungefähr";
  };
  fussweg?: {
    distanz_m: number;
    dauer_min: number;
    genauigkeit: "Route berechnet" | "ungefähr";
  };
  neu: boolean;
  hinweis?: string;
};

export type Wohnungsdaten = {
  aktualisiert_am: string;
  bezugspunkt: string;
  wohnungen: Wohnung[];
};
