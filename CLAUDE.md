# CLAUDE.md

Guidance for working in this repository.

## Projektkontext

`homepage-Kito` ist ein **eigenständiges Projekt** — ein self-hosted Dashboard für Services, Bookmarks und Widgets. Es basiert ursprünglich auf dem Code von [gethomepage/homepage](https://github.com/gethomepage/homepage) (GPLv3), wird aber **eigenständig weiterentwickelt** und nicht als Fork zur Rückführung an Upstream gepflegt.

**Ziel des Projekts:** Das Dashboard **schrittweise** um eine **UI-gestützte Konfiguration** erweitern. Heute wird ausschließlich über YAML-Dateien konfiguriert; das Projekt ergänzt eine Admin-/Config-UI, die diese Dateien sicher lesen und bearbeiten kann.

**Leitplanken:**

- Die bestehende Homepage-Architektur **nicht ersetzen oder umschreiben**.
- **Volle Kompatibilität** mit `services.yaml`, `bookmarks.yaml`, `widgets.yaml`, `settings.yaml` erhalten — YAML bleibt die Quelle der Wahrheit.
- Bestehender Lese-/Render-Pfad (`/api/services`, Dashboard) bleibt unangetastet.
- Inkrementell: jede Stufe ist für sich nutzbar; neue Features sind standardmäßig **deaktiviert**.

## Projektkommunikation

**Projektsprache für die Kommunikation ist Deutsch. Die technische Implementierungssprache bleibt Englisch.**

- Sämtliche Antworten, Statusberichte, Planungen, Architekturvorschläge, Commit-Zusammenfassungen, Verifikationsberichte und Rückfragen erfolgen standardmäßig auf **Deutsch**.
- **Code, Variablennamen, Dateinamen, API-Endpunkte und technische Bezeichner** bleiben in ihrer ursprünglichen Sprache (meist Englisch), sofern dies im Projekt üblich ist.
- **Commit-Messages** dürfen weiterhin Englisch sein, um GitHub- und Open-Source-Konventionen einzuhalten.
- **Benutzersichtbare Texte in der Anwendung** richten sich nach dem Sprachsystem der App (next-i18next) und müssen nicht zwangsläufig Deutsch sein.
- Englische Begriffe aus externen Dokumentationen, Bibliotheken oder APIs werden **nicht künstlich übersetzt**.

Für Plan-Modi gilt: Architekturvorschläge, Vor- und Nachteile, Empfehlungen, Abschlussberichte und Verifikationen immer auf **Deutsch** formulieren. Nur bei ausdrücklichem Wunsch auf Englisch wechseln.

## Tech-Stack

- **Next.js 16** mit **Pages Router** (`src/pages/`), `output: "standalone"`, SSG via `getStaticProps`.
- **React 19**, **Tailwind CSS v4**, `@headlessui/react`, `react-icons`.
- **next-i18next** (Crowdin-Übersetzungen unter `public/locales/<lang>/common.json`).
- **js-yaml** für YAML, **winston** für Logging, **memory-cache** für Env-Var-Caching.
- **Vitest** für Tests, **ESLint + Prettier** (`prettier-plugin-organize-imports`).
- **pnpm only** (`preinstall` erzwingt pnpm via `only-allow`).

## Befehle

```bash
pnpm dev             # Dev-Server (Port 3000)
pnpm build           # next build --webpack
pnpm start           # Production-Server
pnpm lint            # ESLint über das ganze Repo
pnpm test            # Vitest (einmalig)
pnpm test:watch      # Vitest Watch-Mode
pnpm test:coverage   # Vitest mit Coverage
```

## Architektur-Landkarte

```
src/
  pages/                  Next.js Pages + API-Routes
    index.jsx             Haupt-Dashboard (getStaticProps, SSG)
    _app.jsx, _document.jsx
    admin/config.jsx      Admin-/Config-UI
    api/
      services/index.js   GET /api/services (read-only Aggregation)
      bookmarks.js, validate.js, ...
      config/[path].js     custom.css / custom.js (read-only)
      config/raw/[file].js GET/POST Roh-Config lesen+schreiben (Config-UI)
  components/             services/, bookmarks/, widgets/, toggles/
  utils/
    config/               Config-Loader (serverseitig, FS + YAML)
      config.js           CONF_DIR, checkAndCopyConfig, getSettings, substituteEnvironmentVars
      service-helpers.js  servicesFromConfig / parseServicesToGroups
      api-response.js     servicesResponse / bookmarksResponse / widgetsResponse
      config-writer.js    readRawConfig / validateYaml / writeRawConfig (Config-UI)
      admin-auth.js       isConfigEditEnabled / checkAdminToken (Config-UI)
    proxy/                Widget-Proxy-Handler + URL-Sanitization
  skeleton/               Default-YAMLs, kopiert bei fehlender Config
  middleware.js           Host-Validierung (HOMEPAGE_ALLOWED_HOSTS), Matcher /api/:path*
  test-utils/             create-mock-res, render-with-providers, Assertions
```

## Config-Konventionen (wichtig)

- **`CONF_DIR`** wird in `src/utils/config/config.js` bestimmt: `process.env.HOMEPAGE_CONFIG_DIR` oder `./config`.
- YAML wird **nur serverseitig** gelesen/geschrieben (API-Routes, `getStaticProps`) — niemals im Client-Bundle. FS-/YAML-Code gehört nach `src/utils/config/`.
- **Kommentare und Platzhalter erhalten:** `services.yaml` kann Kommentare und `{{HOMEPAGE_VAR_*}}` / `{{HOMEPAGE_FILE_*}}`-Platzhalter (siehe `substituteEnvironmentVars`) enthalten. Beim Editieren **roh** arbeiten (Text 1:1), nicht parsen→neu-serialisieren, sonst gehen Kommentare/Platzhalter verloren.
- Beim Schreiben: vor YAML-Syntaxvalidierung niemals speichern; Backup + atomic write (siehe `config-writer.js`).

### Env-Variablen der UI-Config

| Variable                     | Default | Zweck                                                                         |
| ---------------------------- | ------- | ----------------------------------------------------------------------------- |
| `HOMEPAGE_CONFIG_EDIT`       | `false` | Aktiviert die Admin-Config-UI und die Lese-Route.                             |
| `HOMEPAGE_CONFIG_EDIT_TOKEN` | –       | Token für Schreibzugriff (POST). Ohne gesetztes Token wird nicht geschrieben. |

Backups landen in `CONF_DIR/.backups/<datei>.<ISO-timestamp>.bak`.

## Code-Konventionen

- ESLint: `import/order` (alphabetisch, Gruppen mit Leerzeile), `import/no-cycle`. In `*.test.js`/`*.spec.js` ist `import/order` deaktiviert (wegen `vi.mock`-Hoisting).
- Prettier mit `prettier-plugin-organize-imports`.
- Tests liegen **neben** dem Code als `*.test.{js,jsx}`; Mocks via `vi.mock` / `vi.hoisted` (Vorlage: `src/utils/logger.test.js`).
- Import-Aliase: `components`, `pages`, `styles`, `utils`, `widgets`, `test-utils` (siehe `jsconfig.json` / `vitest.config.mjs`).

## Lizenz & Herkunft

Der Code basiert ursprünglich auf [gethomepage/homepage](https://github.com/gethomepage/homepage) (**GPLv3**); diese Lizenz **gilt weiter** und muss eingehalten werden (Copyright-/Lizenzhinweise erhalten). `homepage-Kito` wird **eigenständig** weiterentwickelt — eine Rückführung an Upstream ist kein Projektziel. Falls doch einmal upstream beigetragen wird, gelten deren Regeln (KI-generierte PRs nur mit expliziter Deklaration; Bug-Reports über GitHub Discussions, nicht Issues).

## Roadmap: UI-gestützte Konfiguration

**Legende:** `P1` = MVP/Bedienbarkeit (≈ M1–M5, weitgehend erledigt) · `P2` = Homelab-Mehrwert · `P3` = KitoDash/Runtime · `★` = persönliche Top-5 · `🔥` = Priorität laut features.md · **(Vision)** = großer Sicherheits-/Architektur-Sprung, **erst nach M7 (Auth/Rollen) + Audit**, verlässt den reinen „Config-UI/read-only"-Rahmen.

1. **Meilenstein 1 (umgesetzt):** Sichere `services.yaml`-Bearbeitung über `/admin/config` — Raw-YAML-Editor + lesende strukturierte Vorschau, Validierung, Backup + atomic write, Gating per Env-Flag + Token. Card-Vorschau + Quick-Add ergänzt.
2. **Meilenstein 2 (umgesetzt):** Gleiche Hybrid-UI für `bookmarks.yaml` über `/admin/bookmarks` (geteilte `ConfigEditor`-Shell, Writer-Whitelist erweitert). Footer-Link auf dem Dashboard, gegated über `GET /api/config/status`.
3. **Meilenstein 3 (umgesetzt):** `widgets.yaml` über `/admin/widgets` als **secret-aware, preview-only** Editor — Redaction sensibler Felder in der Vorschau, `{{HOMEPAGE_VAR_*}}`/`{{HOMEPAGE_FILE_*}}` bleiben sichtbar, **kein** Quick-Add (AddDialog in der Shell optional gemacht). Writer-Whitelist + Widgets-Nav-Tab ergänzt.
4. **Meilenstein 4 (umgesetzt):** `settings.yaml` über `/admin/settings` als **secret-aware, preview-only** Editor — strukturierte Vorschau gruppiert bekannte Settings (Allgemein, Layout/UI, Verhalten, Hintergrund/Branding, Provider/Integrationen), unbekannte Felder unter „Weitere Einstellungen"; Redaction-/Platzhalter-Logik in geteiltes `secret-mask.js` extrahiert (von `widget-preview.js` mitgenutzt). `providers:` wird als Secret-Value-Container behandelt (Namen sichtbar, Werte redigiert). Damit ist die Hybrid-UI für alle vier Config-Dateien abgedeckt.
5. **Meilenstein 5 – Strukturierte Bearbeitung (Formulare):** Einträge per Formular bearbeiten/löschen mit **kommentarerhaltendem** YAML-Parser (eemeli `yaml`, Document-API) statt destruktivem Round-Trip. Raw-YAML bleibt Quelle der Wahrheit; Änderungen landen nur im Editor, Validate/Save/Backup bleiben manuell.
   - **5a (umgesetzt):** `services.yaml` – Edit + Delete bestehender Service-Einträge. Neues `utils/config/yaml-edit.js` (`updateServiceEntry`/`deleteServiceEntry`); `ConfigEditor`-Shell additiv um optionale Props `EditDialog`/`editEntry`/`deleteEntry` erweitert; Edit/Delete-Buttons in der Card-Vorschau; `ServiceAddDialog` zu mode-fähigem `ServiceFormDialog` verallgemeinert. **Bare-unquotete** `{{HOMEPAGE_*}}` werden zum Schutz abgelehnt (Hinweis: Raw-Editor). `doc.toString()` bewusst **ohne** Optionen → layout-treu (4/8-Einrückung, Kommentare, Leerzeilen, `---`).
   - **5b (umgesetzt):** Edit + Delete auch für `bookmarks.yaml`, `widgets.yaml` und `settings.yaml` (gleiches Shell-Muster, Locator reicht das ganze `entry` durch). Neue Helfer in `yaml-edit.js` (`updateBookmarkEntry`/`deleteBookmarkEntry`, `updateWidgetOptions`/`deleteWidget`, `updateSetting`/`deleteSetting`) + geteilte `applyScalarField`/`applyRename`. **secret-aware** für `widgets.yaml`/`settings.yaml` via `secret-mask.js`: echte Secrets werden nie vorbefüllt, bei „leer = behalten" nicht überschrieben, `[redacted]` wird nie geschrieben; `editable`-Flag in `widget-preview.js`/`settings-preview.js` (nur skalare, nicht-secret, nicht-Platzhalter Werte). **v1-Grenzen:** Widgets nur String-Optionen editierbar (Zahlen/Booleans/Objekte → raw), kein Typ-Wechsel/Add; Settings nur skalare nicht-secret Werte (komplexe/`providers` → raw, Delete erlaubt); Bookmarks ohne Gruppenwechsel.
   - **5c (umgesetzt):** Verschieben/Umsortieren per **Hoch/Runter-Buttons** (kein Drag&Drop). Neue Helfer in `yaml-edit.js` (`moveEntryInGroup`, `moveGroup`, `moveEntryToGroup`, `moveWidget`); Move-Controls zentral in der `Preview`-Shell (Cards unverändert), bei bare `{{HOMEPAGE_*}}` ausgeblendet (wie Edit/Delete). **services/bookmarks:** Reihenfolge in Gruppe, Gruppen umsortieren, zwischen Gruppen verschieben (Cross-Group hängt v1 ans **Ende** der Zielgruppe; `toSeq.flow=false` erzwingt Block-Stil auch bei zuvor geleerten `[]`-Gruppen). **widgets:** nur ▲/▼ per Index. **settings ausgeklammert** (Anzeige-Gruppen ≠ Dateireihenfolge). **Limit (M5c-2):** beim Reorder wandert ein als `commentBefore` gebundener Kommentar mit seinem Knoten mit (ein Datei-Kopf-Kommentar ohne `---`-Bindung kann so in die Mitte rutschen) — valide, vor Save im Raw-Editor sichtbar. **Tabs** erst mit M6.
   - **5d (geplant):** echtes **Drag & Drop** als Alternative zu Hoch/Runter (Einträge/Gruppen/Kacheln ziehen). (F1)
6. **Meilenstein 6 – Tabs/Layout-Verwaltung (geplant):** Neue Tabs anlegen die oberhalb der Gruppen stehen aber unter der Suche und das Gruppen-Layout über die UI verwalten (entspr. `settings.yaml` `layout`/Tab-Zuordnung; vgl. `components/tab.jsx`).
7. **Meilenstein 7 – Authentifizierung & Rollen/Berechtigungen (geplant):** Echte Auth/Session statt statischem Token, optional Audit-Log; rollenbasierte Rechte – Nur-Lesen vs. Bearbeiten, granular pro Tab/Gruppe/Kachel; nur Admins dürfen Services & Co. bearbeiten.
   - **Migration weg vom Env-Gating:** Mit echter Auth werden die Env-Flags `HOMEPAGE_CONFIG_EDIT` und `HOMEPAGE_CONFIG_EDIT_TOKEN` **entfernt** — Zugriff/Schreibrecht wird dann über Rollen/Rechte gesteuert (nicht mehr über Env + statisches Token).
   - **Admin-Button rollenabhängig:** Der **Admin**-Button oben rechts im Dashboard-Header erscheint dann **nur für Admins** (statt über `GET /api/config/status` / Env-Flag); analog die Sichtbarkeit der `/admin/*`-Seiten.
   - **Abgrenzung zu M10:** Reine **Ansichts-Profile** werden in M10 behandelt; echte per-User-Rechte und sicherheitsrelevante User-Bindung gehören hierher nach M7.
8. **Meilenstein 8 – Theming, Branding & Custom UI (geplant):** Theming/Branding deutlich erweitern und `custom.css`/`custom.js` über die UI bearbeitbar machen. Geplante Teilbereiche:
   - **8a Theme-Presets:** einfache Auswahl per Buttons, z. B. rund/weich, kantig/technisch, Glasoptik/Blur, kompakt, minimal, OLED-Dark, Homelab-Neon.
   - **8b Hintergrundbild-Upload:** Hintergrundbilder über die UI hochladen/entfernen, optional Overlay, Abdunklung, Blur, Position und Skalierung einstellen; Speicherung kontrolliert unter `CONF_DIR`.
   - **8c Visueller Theme-Editor:** Akzentfarbe, Kartenradius, Rahmenstärke, Schatten, Transparenz, Blur-Stärke, Abstände und Kompaktheit über UI-Regler bearbeiten.
   - **8d Custom-CSS/JS-Editor:** `custom.css` und optional `custom.js` über die UI bearbeiten, mit Warnhinweisen, Validierung soweit sinnvoll und Backup/Restore.
   - **8e Theme Import/Export:** Themes exportieren/importieren, ohne Secrets oder lokale Pfade ungewollt offenzulegen.
   - **8f Theme pro Benutzer:** Themes können pro benutzer induviduell sein und hinterlegt werden.

#### Phase 1/2 – read-only, mit den Leitplanken vereinbar

9. **M9 – Status & Health pro Dienst (P2, ★, 🔥🔥🔥):** online/offline, Antwortzeit, HTTP-Code, letzter Check, Warnsymbol, Mini-Verlauf; sortier-/filterbar („nur kaputte/langsame Dienste"), optional Benachrichtigung. Nutzt Homepage `siteMonitor`/ping; read-only. (F3; ersetzt Backlog „Service-Test")
10. **M10 – Profile & Ansichts-Modi (P2/P3, ★, 🔥🔥🔥):** Profile (Admin/Familie/Gast/Kinder/Mobil) + Modi (Normal/Admin/Wartung/Familie), Umschalter, Sichtbarkeit pro Profil, „unsichtbar statt gelöscht". Sichtbarkeit read-only; echte User-Bindung via M7. (F2+F8; verzahnt mit M6/M7)
11. **M11 – Smart Search / Command Palette (P2, 🔥🔥):** `Strg+K`/`/`: Services/Bookmarks/Gruppen suchen, zuletzt geöffnet, Einstellungen/Logs öffnen; später Admin-Aktionen. (F4; erweitert QuickLaunch + Backlog „Such-/Filter")
12. **M12 – Favoriten & „Zuletzt/Häufig verwendet" (P2):** anpinnen, lokale Historie, kontextabhängige Vorschläge; lokal + abschaltbar. (F11)
13. **M13 – Kontext-Badges pro Dienst (P2):** LAN/VPN/Public/Admin/Familie/Kritisch/Backup/Beta… konfigurierbar. (F12)
14. **M14 – Multi-URL & Safe-Links (LAN/Tailscale/Public) (P2/P3, ★, 🔥🔥):** pro Dienst `urls{lan,tailscale,public}`, Auto-Wahl nach Kontext, Warnung bei versehentlich öffentlichem Link, Fallback. (F18 + Tailscale-Teil F6)
15. **M15 – Service-Doku in der Kachel (P2):** Info-Panel (Zweck/Server/Backup/Admin/Notiz/„was tun bei Fehler"). (F17)
16. **M16 – Mobile-first & PWA (P2, 🔥🔥):** untere Nav, große Suche, Favoriten oben, Swipe, kompakte Karten, „nur Favoriten", Long-Press-Aktionen, PWA, Offline-Fallback, QR. (F10; erweitert Backlog „Mobile-Optimierung")
17. **M17 – Backup, Restore & Änderungsverlauf/Rollback (P1/P2, ★, 🔥🔥):** Backups anzeigen/ansehen/Diff/Restore/Download, Verlauf (wann/was/wer), Kommentar, Rollback. (F15; bündelt Backlog „Backup-/Restore-UI" + „Audit-Log")
18. **M18 – Konfigurations-Health-Checks (P1/P2, 🔥🔥🔥):** über Syntax hinaus (fehlende `href`/Pflichtfelder, doppelte Namen/URLs, Icon existiert?, Widget-Typ?, Secret sichtbar?, Einrückung/Gruppen); präzise Meldungen (Datei/Gruppe/Dienst/Feld), Reparaturvorschläge, Vorher/Nachher, Backup. (F7; erweitert Backlog „Config-Health-Checks")
19. **M19 – Import-Assistent (P2/P3):** Import aus Homepage-YAML/Homarr/Dashy/Browser-Bookmarks/Docker-Compose/Uptime-Kuma/Traefik/NPM; Vorschau, Duplikaterkennung, Secrets nie im Klartext. (F16; erweitert Backlog „Import-Assistent")

#### Phase 3 – Vision / Runtime / Infra

Diese Meilensteine sind ausdrücklich **(Vision)**. Sie dürfen erst nach **M7 (Auth/Rollen) + Audit** umgesetzt werden, weil sie den reinen „Config-UI/read-only"-Rahmen verlassen.

20. **M20 – (Vision) Service-Aktionen aus der Kachel (P3, 🔥🔥):** Öffnen/Admin/Logs/Neustart/Status; gefährliche Aktionen nur mit Bestätigung + Admin-Recht, protokolliert; „Nur anzeigen"-Modus. (F5)
21. **M21 – (Vision) Autodiscovery & Integrationen Docker/Proxmox/Tailscale (P3, 🔥🔥):** Docker-Label-Discovery + Vorschläge + Compose-Snippet + Status/Neustart; Proxmox Nodes/VMs/LXC + Ressourcen + Console; Tailscale-Erreichbarkeit/Badges. (F6)
22. **M22 – (Vision) Einrichtungsassistent (P3):** Sprache/Layout, Docker-Socket optional, Container scannen, Dienste/Gruppen vorschlagen, Icons automatisch. (F9; baut auf M21)
23. **M23 – (Vision) Wartungs- & Update-Zentrale (P3):** Updates verfügbar, alte Images, ungenutzte/ohne Backup/Healthcheck/Icon, IP-statt-DNS-Hinweise. (F20)
24. **M24 – (Vision) Notfall-Ansicht (P3):** kritische IPs/Zugänge, Backup-Orte, letzte funktionierende URLs, Hinweise, Export PDF/Markdown. (F14)
25. **M25 – (Vision) Abhängigkeits- & Server-/Netzwerk-Überblick (P3):** strukturierter Baum pro Server, Ursachen-Hinweise bei Ausfall. (F13+F19)

**Phasen-Mapping:**

- **Phase 1 (MVP):** ≈ bereits durch M1–M5 abgedeckt (UI-Editor + Move + Validierung + Backup); Rollback = M17.
- **Phase 2 (Homelab-Mehrwert):** M9–M19 (read-only).
- **Phase 3 (KitoDash/Runtime):** M7, M20–M25.

### Verifikationsstatus (manuelle Browser-Prüfung, 2026-05-30)

Per Playwright-Chromium gegen `pnpm dev` getrieben; alle Punkte **bestanden**:

- **Services (`/admin/config`):** lädt `services.yaml` (Kommentare erhalten), Card-Vorschau pro Gruppe, Add-Service fügt gültiges YAML **nur in den Editor** ein (Disk unverändert; URL mit `#` korrekt gequotet), Validate meldet Zeile/Spalte bei kaputtem YAML, Save nur mit korrektem Token (ohne/falsch → abgelehnt), Backup unter `config/.backups/` angelegt (== Vorzustand), Dashboard zeigt Service nach Reload.
- **Bookmarks (`/admin/bookmarks`):** lädt `bookmarks.yaml`, Card-Vorschau mit Abbr-Badge, Add-Bookmark erzeugt korrekt verschachteltes `- abbr/href/…`-YAML, Validate/Save/Backup wie oben, Dashboard zeigt Bookmark nach Reload.
- **Widgets (`/admin/widgets`) — v1 secret-aware, PASS:** lädt die rohe `widgets.yaml` (Kommentare erhalten); Preview-Cards zeigen Widgets korrekt an; sensible Felder (`username`, `password`, `token`, `secret`, `apiKey`) erscheinen in der Vorschau als `[redacted]`; **echte Secret-Werte tauchen nicht im Preview-DOM auf** (inkl. `title`-Attribute); `{{HOMEPAGE_VAR_*}}`/`{{HOMEPAGE_FILE_*}}`-Platzhalter bleiben sichtbar; der Raw-Editor enthält weiterhin den originalen YAML-Inhalt (YAML bleibt Quelle der Wahrheit); Validate, Save, Backup und Gating funktionieren; **preview-only** (kein Add-Button/-Dialog).
- **Settings (`/admin/settings`) — v1 secret-aware, PASS:** lädt die rohe `settings.yaml` (Kommentare erhalten); strukturierte Vorschau in 6 Gruppen, unbekannte Felder unter „Weitere Einstellungen" (nicht verworfen); sensible Feldnamen und `providers:`-Werte als `[redacted]`, Provider-**Namen** bleiben sichtbar; **echte Secret-Werte tauchen nicht im Preview-DOM auf**; `{{HOMEPAGE_VAR_*}}`/`{{HOMEPAGE_FILE_*}}`-Platzhalter bleiben sichtbar (auch unquotet im Container); Raw-Editor unverändert, Validate/Save/Backup/Gating funktionieren; **preview-only**.
- **Gating aus (`HOMEPAGE_CONFIG_EDIT` ungesetzt):** `/api/config/status` → `{enabled:false}`; Raw-Route GET/POST → 404 (auch mit gültigem Token); Editor-Seiten zeigen Disabled-Hinweis statt Editor; Footer-Link versteckt.
- **Gating an:** Footer-Link sichtbar; Schreiben erfordert weiterhin `HOMEPAGE_CONFIG_EDIT_TOKEN`.
- **Services – strukturierte Bearbeitung (M5 5a), PASS (Browser-E2E + Unit-Tests grün):** Edit ändert Felder bzw. ergänzt fehlende; Description, Inline-Kommentare, Leerzeilen, 4/8-Einrückung und `---` bleiben erhalten; Delete entfernt nur den Zieleintrag (geleerte Gruppe bleibt als `[]`); Änderungen landen **nur im Editor** (Disk unverändert bis Save); bare-unquotete `{{HOMEPAGE_*}}` werden abgelehnt.
- **Bookmarks/Widgets/Settings – strukturierte Bearbeitung (M5 5b), PASS (Browser-E2E + 28 yaml-edit-Unit-Tests, 1481 Tests gesamt grün):** Bookmark-Edit (abbr GH→GHB) erhält Nesting + Kommentare; Widget-Edit ändert nur das geänderte Feld (provider→google), andere Widgets/Optionen byte-gleich, Widget-Delete per Index; Settings zeigt `providers` als `{…:"[redacted]"}` (Namen sichtbar) **ohne** Edit-Button (nur Delete); Secrets bleiben byte-gleich und `[redacted]` wird nie geschrieben; Disk unverändert bis Save.
- **Verschieben/Umsortieren (M5c), PASS (Browser-E2E + Move-Unit-Tests, gesamt grün):** services — Gruppe ▲ (My Second Group nach oben), Cross-Group (My First Service ans Ende von My Third Group, Quellgruppe `[]`, **Block-Stil** nach Fix M5c-1), Eintrag ▲/▼ in Gruppe; Kommentare + 😎 erhalten. widgets — ▲/▼ per Index, **keine** Gruppen-/„→ Gruppe"-Controls. settings — keine Move-Controls. Disk unverändert bis Save. (Hinweis M5c-2: `commentBefore`-Kommentare wandern beim Reorder mit dem Knoten.)
- **Header-Navigation:** Dashboard-Header mit **Home** (links) + gated **Admin**-Button (rechts, via `/api/config/status`); „← Dashboard"-Rücklink in der Admin-Shell. Preview-Server kann die Config-UI über ein `env`-Feld in `.claude/launch.json` aktivieren.

Kleinere Beobachtung (kein Bug): Bookmark-Cards im 3-Spalten-Raster wirken auf breiten Screens schmal (Name/URL truncaten stark) — rein kosmetisch, read-only.

**Hinweis für künftige Browser-Verifikationen:** Vor einem erneuten `pnpm dev`-Start immer sicherstellen, dass Port 3000 frei ist bzw. alte `next`-Prozesse beendet wurden (`pkill -f next`, dann Port prüfen). Sonst belegt ein alter Server den Port weiter, der neue Start scheitert mit `EADDRINUSE`, und Requests treffen weiterhin den alten Server mit anderen Env-Flags — das verfälscht insbesondere die Gating-Verifikation (z. B. `enabled:true` statt `false`). **Zusätzlich:** Wenn die Editor-Seite hängt (loadState „Loading…") oder die dynamische Route `/api/config/raw/[file]` eine **Next-404-HTML** statt JSON liefert, obwohl `/api/config/status` `enabled:true` meldet, liegt meist ein **stale `.next`-Build-Cache** vor → Server stoppen, `rm -rf .next`, neu starten.

## Vorgemerkte spätere Komfort-Features

Ideen-Backlog für spätere Ausbaustufen (noch nicht eingeplant, nach Bedarf in die Roadmap zu überführen). Es gelten durchgängig die **Leitplanken** am Ende dieses Abschnitts.

> **Hinweis:** Backup/Restore, Audit-Log, Import-Assistent, Config-Health-Checks, Mobile-Optimierung, Such-/Filter und Service-Test werden inzwischen als Meilensteine **M9/M11/M16/M17/M18/M19** geführt. Die folgenden Detail-Bullets bleiben als deren Spezifikation erhalten. Icon-/Favicon-Helfer bleibt weiterhin relevant für **M22**.

### Backup-/Restore-UI

- vorhandene Backups aus `CONF_DIR/.backups/` anzeigen
- Backup ansehen
- Diff zwischen aktueller Datei und Backup anzeigen
- Backup wiederherstellen
- Backup herunterladen
- Wiederherstellung nur nach Bestätigung

### Icon- und Favicon-Helfer

- Favicon aus URL ermitteln
- passende Icons per KI vorschlagen — alternativ aus [homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons/) (automatische Erkennung per Knopfdruck)
- lokale Icons nutzen
- Icon-Vorschau anzeigen
- dashboard-icons durchsuchen
- Icons optional lokal cachen
- fehlende Icons oder ungültige Icon-Pfade markieren

### Import-Assistent

- Import aus Homepage-YAML
- Import aus Mafl-Konfiguration
- Import aus Homarr-Export
- Vorschau vor Übernahme
- Duplikaterkennung
- Secrets nie ungeprüft im Klartext importieren

### Config-Health-Checks

- fehlende URLs erkennen
- doppelte Namen erkennen
- ungültige oder nicht erreichbare URLs markieren
- fehlende Icons markieren
- unsichere Secret-Verwendung markieren
- Hinweise geben, ohne automatisch umzuschreiben

### Service-Test aus der UI

- Service-URL aus der Config heraus testen
- HTTP-Status und Antwortzeit anzeigen
- Fehler verständlich anzeigen
- optional später `siteMonitor` komfortabel setzen

### Audit-Log / Änderungsverlauf

- speichern, wann welche Config-Datei geändert wurde
- Backup-Pfad und Aktion dokumentieren
- später mit Benutzer/Auth verknüpfen
- keine Secrets loggen

### Mobile-Editor-Optimierung

- auf kleinen Bildschirmen Editor/Preview als Tabs statt Zwei-Spalten-Layout
- größere Touch-Ziele
- Raw-YAML einklappbar machen
- Vorschau priorisieren

### Such-/Filterfunktion in der Config-UI

- Suche, die **Services und Bookmarks** durchsucht, um Einträge schneller zu finden
- über Name, URL/`href`, Beschreibung und Gruppe filtern
- Treffer in der Card-Vorschau hervorheben/einklappen (nur passende Gruppen/Einträge zeigen)
- in den Editor-Seiten (`/admin/config`, `/admin/bookmarks`) verfügbar; rein lesend, ändert die YAML nicht
- optional später auch `widgets.yaml`/`settings.yaml` durchsuchbar machen

### Leitplanken für alle Komfort-Features

- YAML bleibt Quelle der Wahrheit.
- Änderungen landen weiterhin zuerst im Editor und werden erst durch Save geschrieben.
- Secrets dürfen nicht in Vorschau, Logs, Tooltips oder Exporten landen.
- Features werden inkrementell und testbar umgesetzt.
- Die bestehende Homepage-Architektur wird nicht ersetzt.
