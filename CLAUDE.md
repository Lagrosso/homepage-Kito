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

## Docker-Deployment

Empfohlener Weg (Details in **`DOCKER.md`**): **auf dem PC bauen → Docker Hub (öffentlich) → Server zieht nur.**

```bash
# PC: einmal `docker login`, .env mit DOCKERHUB_IMAGE füllen, dann:
./scripts/docker-build-push.sh           # docker build + push
# Server: docker-compose.yml + .env (HOMEPAGE_SESSION_SECRET!), dann:
docker compose pull && docker compose up -d   # → http://server:3000 → /setup
```

- `docker-compose.yml` (Repo-Root) zieht nur `${DOCKERHUB_IMAGE}` (kein Build auf dem Server);
  `.env.example` als Vorlage; `.env` ist gitignored.
- **`HOMEPAGE_SESSION_SECRET` ist Pflicht** (≥32 Zeichen), sonst startet die App nicht.
  `HOMEPAGE_ALLOWED_HOSTS` setzen, sobald der Zugriff nicht über `localhost:3000` läuft.
- Der Healthcheck nutzt `GET /api/healthcheck` — dieser Pfad ist in `middleware.js` **vor** der Login-Wall
  freigeschaltet (sonst meldet Docker den Container fälschlich „unhealthy").
- **Wichtig (Next-Build):** Test-Dateien dürfen **nicht** direkt unter `src/pages/` (außer `pages/api/**`)
  liegen — `next build` behandelt sie sonst als Seite und bricht ab. Seiten-Tests gehören nach
  `src/__tests__/pages/` (z. B. `auth-pages.test.jsx`). `pnpm dev`/`pnpm test` zeigen das nicht, nur der
  Production-Build (`pnpm build`).

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
      config/raw/[file].js GET/POST Roh-Config lesen+schreiben (Admin-Rolle)
      auth/*              Login/Logout/Setup/Session-Status
  components/             services/, bookmarks/, widgets/, toggles/
  utils/
    config/               Config-Loader (serverseitig, FS + YAML)
      config.js           CONF_DIR, checkAndCopyConfig, getSettings, substituteEnvironmentVars
      service-helpers.js  servicesFromConfig / parseServicesToGroups
      api-response.js     servicesResponse / bookmarksResponse / widgetsResponse
      config-writer.js    readRawConfig / validateYaml / writeRawConfig (Admin-Config-UI)
      password.js         scrypt-Hashing
      session.js          iron-session Optionen + Rollenhelfer (edge-safe)
      users.js            dateibasierter User-Store (`users.yaml`)
    proxy/                Widget-Proxy-Handler + URL-Sanitization
  skeleton/               Default-YAMLs, kopiert bei fehlender Config
  middleware.js           Host-Validierung + Login-Wall (Cookie-Session, edge-safe)
  test-utils/             create-mock-res, render-with-providers, Assertions
```

## Config-Konventionen (wichtig)

- **`CONF_DIR`** wird in `src/utils/config/config.js` bestimmt: `process.env.HOMEPAGE_CONFIG_DIR` oder `./config`.
- YAML wird **nur serverseitig** gelesen/geschrieben (API-Routes, `getStaticProps`) — niemals im Client-Bundle. FS-/YAML-Code gehört nach `src/utils/config/`.
- **Kommentare und Platzhalter erhalten:** `services.yaml` kann Kommentare und `{{HOMEPAGE_VAR_*}}` / `{{HOMEPAGE_FILE_*}}`-Platzhalter (siehe `substituteEnvironmentVars`) enthalten. Beim Editieren **roh** arbeiten (Text 1:1), nicht parsen→neu-serialisieren, sonst gehen Kommentare/Platzhalter verloren.
- Beim Schreiben: vor YAML-Syntaxvalidierung niemals speichern; Backup + atomic write (siehe `config-writer.js`).

### Env-Variablen für Auth/Session

| Variable                  | Default | Zweck                                                                        |
| ------------------------- | ------- | ---------------------------------------------------------------------------- |
| `HOMEPAGE_SESSION_SECRET` | –       | Pflicht-Secret für das verschlüsselte Session-Cookie, mindestens 32 Zeichen. |
| `HOMEPAGE_SECURE_COOKIE`  | `false` | `Secure`-Flag des Session-Cookies. Nur bei HTTPS auf `true`; über HTTP muss es `false` bleiben, sonst verwirft der Browser das Cookie und Login schlägt fehl. |

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

1. **Meilenstein 1 (umgesetzt):** Sichere `services.yaml`-Bearbeitung über `/admin/config` — Raw-YAML-Editor + lesende strukturierte Vorschau, Validierung, Backup + atomic write, inzwischen per Admin-Rolle geschützt. Card-Vorschau + Quick-Add ergänzt.
2. **Meilenstein 2 (umgesetzt):** Gleiche Hybrid-UI für `bookmarks.yaml` über `/admin/bookmarks` (geteilte `ConfigEditor`-Shell, Writer-Whitelist erweitert). Footer-Link auf dem Dashboard, inzwischen rollenbasiert nur für Admins sichtbar.
3. **Meilenstein 3 (umgesetzt):** `widgets.yaml` über `/admin/widgets` als **secret-aware, preview-only** Editor — Redaction sensibler Felder in der Vorschau, `{{HOMEPAGE_VAR_*}}`/`{{HOMEPAGE_FILE_*}}` bleiben sichtbar, **kein** Quick-Add (AddDialog in der Shell optional gemacht). Writer-Whitelist + Widgets-Nav-Tab ergänzt.
4. **Meilenstein 4 (umgesetzt):** `settings.yaml` über `/admin/settings` als **secret-aware, preview-only** Editor — strukturierte Vorschau gruppiert bekannte Settings (Allgemein, Layout/UI, Verhalten, Hintergrund/Branding, Provider/Integrationen), unbekannte Felder unter „Weitere Einstellungen"; Redaction-/Platzhalter-Logik in geteiltes `secret-mask.js` extrahiert (von `widget-preview.js` mitgenutzt). `providers:` wird als Secret-Value-Container behandelt (Namen sichtbar, Werte redigiert). Damit ist die Hybrid-UI für alle vier Config-Dateien abgedeckt.
5. **Meilenstein 5 – Strukturierte Bearbeitung (Formulare):** Einträge per Formular bearbeiten/löschen mit **kommentarerhaltendem** YAML-Parser (eemeli `yaml`, Document-API) statt destruktivem Round-Trip. Raw-YAML bleibt Quelle der Wahrheit; Änderungen landen nur im Editor, Validate/Save/Backup bleiben manuell.
   - **5a (umgesetzt):** `services.yaml` – Edit + Delete bestehender Service-Einträge. Neues `utils/config/yaml-edit.js` (`updateServiceEntry`/`deleteServiceEntry`); `ConfigEditor`-Shell additiv um optionale Props `EditDialog`/`editEntry`/`deleteEntry` erweitert; Edit/Delete-Buttons in der Card-Vorschau; `ServiceAddDialog` zu mode-fähigem `ServiceFormDialog` verallgemeinert. **Bare-unquotete** `{{HOMEPAGE_*}}` werden zum Schutz abgelehnt (Hinweis: Raw-Editor). `doc.toString()` bewusst **ohne** Optionen → layout-treu (4/8-Einrückung, Kommentare, Leerzeilen, `---`).
   - **5b (umgesetzt):** Edit + Delete auch für `bookmarks.yaml`, `widgets.yaml` und `settings.yaml` (gleiches Shell-Muster, Locator reicht das ganze `entry` durch). Neue Helfer in `yaml-edit.js` (`updateBookmarkEntry`/`deleteBookmarkEntry`, `updateWidgetOptions`/`deleteWidget`, `updateSetting`/`deleteSetting`) + geteilte `applyScalarField`/`applyRename`. **secret-aware** für `widgets.yaml`/`settings.yaml` via `secret-mask.js`: echte Secrets werden nie vorbefüllt, bei „leer = behalten" nicht überschrieben, `[redacted]` wird nie geschrieben; `editable`-Flag in `widget-preview.js`/`settings-preview.js` (nur skalare, nicht-secret, nicht-Platzhalter Werte). **v1-Grenzen:** Widgets nur String-Optionen editierbar (Zahlen/Booleans/Objekte → raw), kein Typ-Wechsel/Add; Settings nur skalare nicht-secret Werte (komplexe/`providers` → raw, Delete erlaubt); Bookmarks ohne Gruppenwechsel.
   - **5c (umgesetzt):** Verschieben/Umsortieren per **Hoch/Runter-Buttons** (kein Drag&Drop). Neue Helfer in `yaml-edit.js` (`moveEntryInGroup`, `moveGroup`, `moveEntryToGroup`, `moveWidget`); Move-Controls zentral in der `Preview`-Shell (Cards unverändert), bei bare `{{HOMEPAGE_*}}` ausgeblendet (wie Edit/Delete). **services/bookmarks:** Reihenfolge in Gruppe, Gruppen umsortieren, zwischen Gruppen verschieben (Cross-Group hängt v1 ans **Ende** der Zielgruppe; `toSeq.flow=false` erzwingt Block-Stil auch bei zuvor geleerten `[]`-Gruppen). **widgets:** nur ▲/▼ per Index. **settings ausgeklammert** (Anzeige-Gruppen ≠ Dateireihenfolge). **Limit (M5c-2):** beim Reorder wandert ein als `commentBefore` gebundener Kommentar mit seinem Knoten mit (ein Datei-Kopf-Kommentar ohne `---`-Bindung kann so in die Mitte rutschen) — valide, vor Save im Raw-Editor sichtbar. **Tabs** erst mit M6.
   - **5d (umgesetzt):** echtes **Drag & Drop** als Alternative zu Hoch/Runter (**@dnd-kit**, Buttons bleiben als barrierefreier Fallback). Neue index-basierte Helfer in `yaml-edit.js` (`moveEntryToIndex`/`moveGroupToIndex`/`moveWidgetToIndex` + `moveEntryToGroup` mit optionalem `toIndex`); `Preview` in `config-editor.jsx` um `DndPreview` (DndContext + SortableContext, Drag-Handle pro Karte/Gruppe) erweitert, aktiv sobald die Index-Helfer verdrahtet sind (services/bookmarks: Einträge in Gruppe, Gruppen, Cross-Group mit Zielposition; widgets: per Index). Mutation nur im Editor; bei bare `{{HOMEPAGE_*}}` deaktiviert (wie M5c). **Nachtrag:** Wenn `settings.yaml` `layout:` nutzt, steuert dieses Layout die sichtbare Gruppen-Reihenfolge; Services-/Bookmarks-Preview blendet Datei-Gruppen-Reorder dann aus und verweist auf `/admin/layout`. (F1)
6. **Meilenstein 6 – Tabs/Layout-Verwaltung:** Tabs (oberhalb der Gruppen, unter der Suche) und das Gruppen-Layout über die UI verwalten (entspr. `settings.yaml` `layout`; vgl. `components/tab.jsx`, `components/services/group.jsx`).
   - **6 v1 (umgesetzt):** Seite `/admin/layout` (eigener Nav-Tab, href-basiertes Highlight). **Tabs anlegen/umbenennen/löschen** + **Gruppe↔Tab zuordnen** (inkl. „kein Tab"). Helfer `assignGroupToTab`/`renameTab`/`deleteTab` in `yaml-edit.js` (eemeli, kommentarerhaltend; Listen-/Objekt-/Fehlt-Form; prunt leere Einträge); read-only `layout-preview.js` (`parseLayout`/`groupNamesFromRaw`, Cross-File aus services+bookmarks); Shell additiv um `PreviewPanel`-Prop erweitert. Eingaben **inline** (kein `window.prompt` — von Next.js 16/Turbopack nicht unterstützt; `confirm` bleibt für Delete). Änderungen nur im Editor; Validate/Save/Backup/Gating wie gehabt.
   - **6b (umgesetzt) – Per-Gruppe-Anzeige & globale Gruppen-Anordnung über die UI:** in `/admin/layout` zusätzlich zu Tabs.
     - **Services-Ausrichtung pro Gruppe:** `style: row` → Services **nebeneinander** (Grid) vs. Default → **untereinander** (`flex flex-col`); `columns: N` (2–8, via `columnMap`) = Services pro Reihe, nur bei `style: row` aktiv (Wechsel auf Default leert `columns` mit).
     - **Globale Gruppen-Anordnung:** `maxGroupColumns` (4–8) = wie viele Gruppen **max. nebeneinander**; **Grenze:** <4 ist global nicht einstellbar (Homepage-`3xl:`-Breakpoint) — weniger pro Reihe via per-Gruppe `style: row` (volle Breite). Beim Setzen wird `fiveColumns` entfernt, damit es den Wert nicht überschreibt.
     - Pro Gruppe zusätzlich: `header` (an/aus), `initiallyCollapsed`, `useEqualHeights` (Checkboxen; „Default" = Feld gelöscht).
     - Neuer generischer Helfer `setGroupLayoutField(raw,{group,field},value)` in `yaml-edit.js` (eemeli, kommentarerhaltend; erbt Block-Erzeugung + Skalar-`layout`-Guard + `flow=false`); `assignGroupToTab` ist jetzt ein Thin-Wrapper darüber. Global via vorhandene `updateSetting`/`deleteSetting`. `layout-preview.js`: `parseLayout` um style/columns/header/initiallyCollapsed/useEqualHeights erweitert + neues `parseGlobalLayout`. Änderungen nur im Editor; Validate/Save/Backup/Gating wie gehabt.
     - **Nachtrag (umgesetzt): globale Gruppen-Reihenfolge in `/admin/layout`.** `moveLayoutGroup`/`moveLayoutGroupToIndex` in `yaml-edit.js` ordnen Gruppen kommentererhaltend über `settings.yaml` `layout:`; `/admin/layout` bietet ▲/▼ dafür. DnD nutzt pointer-basierte Kollisionserkennung (`dndCollisionDetection`).
     - **Nachtrag (umgesetzt): Tab-Reihenfolge in `/admin/layout`.** `moveLayoutTab` verschiebt alle Layout-Gruppen eines Tabs gemeinsam in der bestehenden `layout:`-Reihenfolge; die UI bietet ▲/▼ direkt an den Tab-Zeilen. Es wird keine neue YAML-Struktur eingeführt.
     - **v1-Grenzen:** Nested Groups in `layout[group]`, per-Gruppe `icon` und `maxBookmarkGroupColumns` bleiben dem Raw-Editor vorbehalten.
7. **Meilenstein 7 – Authentifizierung & Rollen/Berechtigungen (umgesetzt):** Echte Cookie-Session (`iron-session`) statt statischem Token; voller Login-Zwang auch für das Dashboard; rollenbasierte Rechte v1.
   - **Rollen v1:** `admin` darf Dashboard ansehen und Configs lesen/schreiben; `viewer` darf nur Dashboard/API-Read-Pfade nutzen. Raw-Config-GET/POST ist nur für Admins erreichbar, damit Klartext-Secrets nicht an Viewer gehen.
   - **Setup v1:** `/setup` legt nur den ersten Admin an, solange noch kein `users.yaml` existiert. Danach erfolgt Login über `/login`.
   - **M7b User-Management-UI (umgesetzt):** `/admin/users` für Admins; Nutzer anlegen, Rolle (`admin`/`viewer`) und Gruppen bearbeiten, Passwort zurücksetzen und Nutzer löschen. Neue Admin-only-API `/api/users` (`GET`/`POST`/`PATCH`/`DELETE`) nutzt `src/utils/config/users.js` (`addUser`, `updateUser`, `updateUserRole`, `setUserPassword`, `deleteUser`) und gibt nur sichere User-Daten ohne `passwordHash` zurück. `users.yaml` bleibt **nicht** in `EDITABLE_CONFIGS`; Passwörter werden nie im Klartext zurückgegeben oder geloggt; letzter Admin ist gegen Löschen/Degradieren geschützt.
   - **Admin-Button rollenabhängig:** Der **Admin**-Button oben rechts im Dashboard-Header und der Footer-Link erscheinen nur für Admins; `/admin/*` redirectet Viewer clientseitig zurück, APIs erzwingen die Rolle serverseitig.
   - **V1-Grenzen:** keine granularen Rechte, kein Audit-Log und keine Self-Service-Passwortänderung.
   - **Abgrenzung zu M10:** Reine **Ansichts-Profile** werden in M10 behandelt; echte per-User-Rechte und sicherheitsrelevante User-Bindung gehören zu M7 und sind Voraussetzung für spätere Runtime-/Admin-Funktionen.
   - **Admin-Sammeltab „Alle Services & Bookmarks" (nach M7):** Ein zusätzlicher, **immer vorhandener** Tab, der **alle** Gruppen aggregiert und **nur für Admins** sichtbar ist. Bewusst **nicht** in M6b umgesetzt: (a) die admin-only-Sichtbarkeit braucht echte Auth/Rollen (M7); (b) ein „zeigt-immer-alles"-Tab ist über Homepages Tab-Modell **nicht rein per `settings.yaml`** abbildbar (Gruppen ohne `tab:` erscheinen bereits auf allen Tabs, mit `tab:` nur dort) und erfordert eine Änderung am **Render-Pfad** (`src/pages/index.jsx`-Tab-Filter) — verlässt die Leitplanke „Render-Pfad unangetastet". Gehört damit zu den Ansichts-Profilen (M10) auf Basis von M7.
8. **Meilenstein 8 – Theming, Branding & Custom UI (umgesetzt):** Neue Admin-Seite `/admin/theme` — eigenständige Seite (kein ConfigEditor-Shell), lädt `settings.yaml` + `custom.css` parallel, speichert getrennt.
   - **8a Theme-Presets (umgesetzt):** 25 Presets (15 Dark, 10 Light) in `utils/config/theme-presets.js`; Preset-Karte zeigt Farbvorschau + Dark/Light-Badge; Klick wendet `color`/`theme`/`cardBlur` via yaml-edit auf `settings.yaml` an. Neues `CONFIG_TABS`-Export aus `config-editor.jsx` für konsistente Nav.
   - **8b Hintergrundbild-Upload (umgesetzt):** Neuer API-Endpunkt `POST /api/config/background-image` (base64-JSON, max. 10 MB) speichert unter `CONF_DIR/images/`; `GET ?file=<name>` liefert Bild aus; Pfad wird via `setBackgroundField` in `settings.yaml` gesetzt. Regler für Deckkraft/Blur/Sättigung/Helligkeit direkt im Theme-UI.
   - **8c Visueller Theme-Editor (umgesetzt):** Farbpalette mit **34 Farben** (23 Tailwind-Standard + `orange`-Fix + 11 neue Custom-Farben: `forest`, `ocean`, `lavender`, `coral`, `gold`, `midnight`, `rust`, `sage`, `maroon`, `neon`, `cherry`); Hell/Dunkel-Toggle; Card-Blur-Auswahl. Alles schreibt in `settings.yaml`.
   - **8d Custom-CSS-Editor (umgesetzt):** `custom.css` über `/admin/theme` bearbeiten — neues `utils/config/css-writer.js` (Backup + atomic write); API `GET/POST /api/config/custom-css` (Admin-only); Warnbanner im UI.
   - **8e Theme Import/Export (umgesetzt):** Export: JSON mit `color`, `theme`, `cardBlur`, `background`-Effekten, `customCss` — ohne `background.image` (Pfad nicht portabel) und ohne Secrets. Import: JSON einfügen → sofort auf `settings.yaml` + `customCss`-State anwenden.
   - **8f Theme pro Benutzer:** ausdrücklich aus M8 ausgeklammert (erfordert User-Store-Erweiterung jenseits von `users.yaml`).
   - **8c-Nachtrag (umgesetzt): ruhige Farbpalette.** Der Farbpicker bietet jetzt eine **kuratierte gedämpfte/pastellige** Auswahl (neutrale Verläufe + 10 neue entsättigte Töne: `fog`, `denim`, `dusk`, `fern`, `moss`, `sage`, `sand`, `clay`, `dust`, `mauve`, `blush`, `lavender`). Die schrillen/satten Farben bleiben in `theme.css`/`themes.js` **definiert** (kein Crash, Presets funktionieren), werden aber nicht mehr angeboten (`ALL_COLORS` kuratiert). `themes.test` erzwingt: jede angebotene Farbe hat eine gültige Palette.
   - **8g Presets entschärfen (umgesetzt):** Die benannten `THEME_PRESETS` in `utils/config/theme-presets.js` nutzen jetzt gedämpfte/pastellige Farben aus der kuratierten Palette statt der zuvor kräftigen Neon-/Cherry-/Dracula-Varianten. `themes.test.js` stellt zusätzlich sicher, dass Preset-Farben in `ALL_COLORS` enthalten sind und eine gültige Palette besitzen.
   - **8h UI-Finishing (umgesetzt):** `settings.cardRadius` wird über `/api/config/theme-vars` als CSS-Variable `--card-radius` in `_app.jsx` gesetzt und in `globals.css` für Karten, Suche, Admin-Buttons, Tabs und Service-Widget-Blöcke genutzt. Dashboard-Tabs klemmen den inneren Radius mobil, damit `cardRadius: full` nicht zu übergroßen Tab-Flächen führt. Font ist global JetBrains Mono (`@fontsource-variable/jetbrains-mono`); die Admin-Navigation ist als flache Unterstrich-Tabs vereinheitlicht.
   - **Neue yaml-edit-Helfer:** `setBackgroundField(raw, field, value)` + `removeBackground(raw)` für nested `background.*` in `settings.yaml`.

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
18. **M18 – Konfigurations-Health-Checks v1 (umgesetzt):** statische, read-only Health-Checks für `services.yaml`, `bookmarks.yaml`, `widgets.yaml` und `settings.yaml`; Admin-only API `/api/config/health` (`GET` Gesamtprüfung, `POST` aktueller Editor-Inhalt), neue Admin-Seite `/admin/health` mit Severity-Filtern und kompakter Health-Check-Button in den bestehenden Config-Editoren. Prüft u. a. YAML-Syntax/-Shape, Tabs in Einrückung, fehlende/duplizierte `href`s, unbekannte `access.groups`, plaintext-sensitive Felder ohne `{{HOMEPAGE_*}}`, Layout-/Theme-Werte und auffällige Asset-Pfade. Keine Netzwerkchecks, keine automatischen Fixes, Save bleibt nur durch YAML-Syntax blockiert. (F7)
19. **M19 – Service-Widget-Konfiguration über `/admin/config` (umgesetzt):** kuratierter UI-Weg für 40 gewünschte Homepage-Service-Widgets direkt am Service-Eintrag in `services.yaml`. Der Service-Edit-Dialog kann `widget:`-Blöcke aktivieren, bearbeiten und entfernen; neue Registry `service-widget-templates.js`; neue YAML-Helfer `updateServiceWidget`/`deleteServiceWidget`; secret-aware (echte Secrets nie vorausgefüllt, leer = behalten, `[redacted]` wird nie geschrieben, `{{HOMEPAGE_*}}` bleibt sichtbar); unbekannte Widget-Optionen bleiben erhalten und Raw-YAML bleibt für Sonderfälle möglich. **M19b-Nachtrag (umgesetzt):** Die Registry ist jetzt eine Schema-Registry mit `optionFields`, `allowedFields`, `defaultFields`, `maxFields`, Typ- und Secret-Metadaten. `/admin/config` zeigt `fields` als Checkbox-Gruppe mit Max-Validierung statt Textfeld. `/admin/widgets` verwaltet strukturierte Info-Widgets für `datetime`, `greeting`, `logo`, `openmeteo`, `resources` und `search` über `info-widget-templates.js`; bekannte Widgets können hinzugefügt/bearbeitet/gelöscht/umsortiert werden, unbekannte bleiben Raw-YAML. `addInfoWidget` und typisierte `updateWidgetOptions` schreiben Booleans/Numbers als echte YAML-Typen. Dashboard-Render-Pfad bleibt unverändert.
20. **M20 – Import-Assistent über `/admin/import` (umgesetzt, weitere Quellen geparkt):** Admin-only Import-Seite mit Preview-/Apply-APIs (`/api/config/import/preview`, `/api/config/import/apply`). V1 importiert bestehende Homepage-Konfiguration aus `services.yaml`, `bookmarks.yaml`, `widgets.yaml`, kuratierten `settings.yaml`-Keys und `docker.yaml`. V2 ergänzt Muximux-Import: aktive Apps werden zu Services, `order`/Gruppen/Collapse zu `settings.layout`, bekannte Icons zu Homepage-Icon-Werten, `health_check` zu `siteMonitor`, `open_mode` zu `target`, Rollenhinweise zu `access.groups` und Docker-Discovery zu `docker.yaml`. Apply schreibt nicht direkt auf Disk, sondern legt Import-Drafts für die bestehenden Editor-Seiten an; Save/Validate/Backup bleiben manuell. Preview gibt keine Rohdaten/Secrets zurück; bei deaktivierter Secret-Übernahme werden Widget-Secrets als `{{HOMEPAGE_VAR_*}}`-Platzhalter geschrieben. Andere Quellen wie Homarr, Dashy, Browser-Bookmarks, Docker-Compose, Uptime-Kuma, Traefik und NPM sind bewusst auf später verschoben. (F16; erweitert Backlog „Import-Assistent")
21. **M21 – Icon- und Favicon-Helfer über `/admin/config` (umgesetzt):** Der Service-Dialog kann per „Find icon" kuratierte Icon-Vorschläge laden und den gewählten Wert direkt ins `icon:`-Feld übernehmen. Admin-only API `/api/config/icon-suggestions`; Utility `icon-suggestions.js` normalisiert Service-Namen/Hosts/Widget-Typen, prüft `homarr-labs/dashboard-icons`, ergänzt `sh-*`/`si-*`-Kandidaten und erkennt Favicons über `/favicon.ico` bzw. HTML-`<link rel="icon">`. Keine freie Websuche, keine lokalen Bilddownloads, keine Credential-Tests; Änderungen landen nur im Editor und der Dashboard-Render-Pfad bleibt unverändert.

#### Phase 3 – Vision / Runtime / Infra

Diese Meilensteine sind ausdrücklich **(Vision)**. Sie dürfen erst nach **M7 (Auth/Rollen) + Audit** umgesetzt werden, weil sie den reinen „Config-UI/read-only"-Rahmen verlassen.

22. **M22 – (Vision) Service-Aktionen aus der Kachel (P3, 🔥🔥):** Öffnen/Admin/Logs/Neustart/Status; gefährliche Aktionen nur mit Bestätigung + Admin-Recht, protokolliert; „Nur anzeigen"-Modus. (F5)
23. **M23 – (Vision) Autodiscovery & Integrationen Docker/Proxmox/Tailscale (P3, 🔥🔥):** Docker-Label-Discovery + Vorschläge + Compose-Snippet + Status/Neustart; Proxmox Nodes/VMs/LXC + Ressourcen + Console; Tailscale-Erreichbarkeit/Badges. (F6)
24. **M24 – (Vision) Einrichtungsassistent (P3):** Sprache/Layout, Docker-Socket optional, Container scannen, Dienste/Gruppen vorschlagen, Icon-Helfer nutzen. (F9; baut auf M23)
25. **M25 – (Vision) Wartungs- & Update-Zentrale (P3):** Updates verfügbar, alte Images, ungenutzte/ohne Backup/Healthcheck/Icon, IP-statt-DNS-Hinweise. (F20)
26. **M26 – (Vision) Notfall-Ansicht (P3):** kritische IPs/Zugänge, Backup-Orte, letzte funktionierende URLs, Hinweise, Export PDF/Markdown. (F14)
27. **M27 – (Vision) Abhängigkeits- & Server-/Netzwerk-Überblick (P3):** strukturierter Baum pro Server, Ursachen-Hinweise bei Ausfall. (F13+F19)

**Phasen-Mapping:**

- **Phase 1 (MVP):** ≈ bereits durch M1–M5 abgedeckt (UI-Editor + Move + Validierung + Backup); Rollback = M17.
- **Phase 2 (Homelab-Mehrwert):** M9–M21 (read-only/config-only).
- **Phase 3 (KitoDash/Runtime):** M7, M22–M27.

### Verifikationsstatus (manuelle Browser-Prüfung, 2026-05-30)

Per Playwright-Chromium gegen `pnpm dev` getrieben; alle Punkte **bestanden**:

- **Services (`/admin/config`):** lädt `services.yaml` (Kommentare erhalten), Card-Vorschau pro Gruppe, Add-Service fügt gültiges YAML **nur in den Editor** ein (Disk unverändert; URL mit `#` korrekt gequotet), Validate meldet Zeile/Spalte bei kaputtem YAML, Save nur für Admin-Session, Backup unter `config/.backups/` angelegt (== Vorzustand), Dashboard zeigt Service nach Reload.
- **Bookmarks (`/admin/bookmarks`):** lädt `bookmarks.yaml`, Card-Vorschau mit Abbr-Badge, Add-Bookmark erzeugt korrekt verschachteltes `- abbr/href/…`-YAML, Validate/Save/Backup wie oben, Dashboard zeigt Bookmark nach Reload.
- **Widgets (`/admin/widgets`) — v1 secret-aware, PASS:** lädt die rohe `widgets.yaml` (Kommentare erhalten); Preview-Cards zeigen Widgets korrekt an; sensible Felder (`username`, `password`, `token`, `secret`, `apiKey`) erscheinen in der Vorschau als `[redacted]`; **echte Secret-Werte tauchen nicht im Preview-DOM auf** (inkl. `title`-Attribute); `{{HOMEPAGE_VAR_*}}`/`{{HOMEPAGE_FILE_*}}`-Platzhalter bleiben sichtbar; der Raw-Editor enthält weiterhin den originalen YAML-Inhalt (YAML bleibt Quelle der Wahrheit); Validate, Save, Backup und Gating funktionieren; **preview-only** (kein Add-Button/-Dialog).
- **Settings (`/admin/settings`) — v1 secret-aware, PASS:** lädt die rohe `settings.yaml` (Kommentare erhalten); strukturierte Vorschau in 6 Gruppen, unbekannte Felder unter „Weitere Einstellungen" (nicht verworfen); sensible Feldnamen und `providers:`-Werte als `[redacted]`, Provider-**Namen** bleiben sichtbar; **echte Secret-Werte tauchen nicht im Preview-DOM auf**; `{{HOMEPAGE_VAR_*}}`/`{{HOMEPAGE_FILE_*}}`-Platzhalter bleiben sichtbar (auch unquotet im Container); Raw-Editor unverändert, Validate/Save/Backup/Gating funktionieren; **preview-only**.
- **Legacy-Gating (vor M7):** Die frühere Env-/Token-Sperre wurde durch Cookie-Session + Rollen ersetzt; Raw-Config-GET/POST ist nur noch für Admins erlaubt.
- **Services – strukturierte Bearbeitung (M5 5a), PASS (Browser-E2E + Unit-Tests grün):** Edit ändert Felder bzw. ergänzt fehlende; Description, Inline-Kommentare, Leerzeilen, 4/8-Einrückung und `---` bleiben erhalten; Delete entfernt nur den Zieleintrag (geleerte Gruppe bleibt als `[]`); Änderungen landen **nur im Editor** (Disk unverändert bis Save); bare-unquotete `{{HOMEPAGE_*}}` werden abgelehnt.
- **Bookmarks/Widgets/Settings – strukturierte Bearbeitung (M5 5b), PASS (Browser-E2E + 28 yaml-edit-Unit-Tests, 1481 Tests gesamt grün):** Bookmark-Edit (abbr GH→GHB) erhält Nesting + Kommentare; Widget-Edit ändert nur das geänderte Feld (provider→google), andere Widgets/Optionen byte-gleich, Widget-Delete per Index; Settings zeigt `providers` als `{…:"[redacted]"}` (Namen sichtbar) **ohne** Edit-Button (nur Delete); Secrets bleiben byte-gleich und `[redacted]` wird nie geschrieben; Disk unverändert bis Save.
- **Verschieben/Umsortieren (M5c), PASS (Browser-E2E + Move-Unit-Tests, gesamt grün):** services — Gruppe ▲ (My Second Group nach oben), Cross-Group (My First Service ans Ende von My Third Group, Quellgruppe `[]`, **Block-Stil** nach Fix M5c-1), Eintrag ▲/▼ in Gruppe; Kommentare + 😎 erhalten. widgets — ▲/▼ per Index, **keine** Gruppen-/„→ Gruppe"-Controls. settings — keine Move-Controls. Disk unverändert bis Save. (Hinweis M5c-2: `commentBefore`-Kommentare wandern beim Reorder mit dem Knoten.)
- **Header-Navigation:** Dashboard-Header mit **Home** (links), rollenbasiertem **Admin**-Button (nur `admin`) und Logout; „← Dashboard"-Rücklink in der Admin-Shell. Preview-Server braucht `HOMEPAGE_SESSION_SECRET` im `env`-Feld von `.claude/launch.json`.
- **Tabs/Layout-Verwaltung (M6 v1), PASS (Browser-E2E + 15 Layout-Unit-Tests, 1507 gesamt grün):** `/admin/layout` lädt Gruppen aus services+bookmarks (Cross-File); Nav-Highlight href-basiert (nur „Layout"); Tab anlegen (Inline-Formular) erzeugt `layout:`-Block (Kommentar + `providers` erhalten), 2. Gruppe zuweisen, Tab umbenennen (Inline), Tab löschen (`confirm`, Einträge geprunt → `layout: []`); Disk unverändert bis Save; andere Admin-Seiten unverändert. **Fix:** `window.prompt` durch Inline-Eingaben ersetzt (Turbopack-Runtime unterstützt `prompt()` nicht). **Kosmetik:** leeres `layout: []` bleibt, wenn alle Gruppen entfernt werden.
- **Drag & Drop (M5d), PASS (Browser-E2E + 7 Index-Move-Unit-Tests, 1527 gesamt grün):** `/admin/config` rendert die `DndPreview` mit Drag-Handles je Karte/Gruppe **neben** den Hoch/Runter-Buttons. Synthetische Pointer-Drags verifiziert: Eintrag **Cross-Group** an Zielindex (`My First Service` → `My Third Group` Pos. 0; Quellgruppe wird `[]`, Block-Stil + 😎 + Kommentare erhalten) und **Gruppen-Reorder** (Third über Second). Mutation **nur im Editor** (Disk unverändert bis Save); bei bare `{{HOMEPAGE_*}}` ist DnD aus (wie M5c). @dnd-kit-Deps ergänzt. **Hinweis:** echte Drag-Simulation via Pointer-Events funktioniert; within-group-Reorder teilt denselben Pfad.
- **Per-Gruppe-Anzeige & globale Anordnung (M6b), PASS (Browser-E2E + Unit-Tests, gesamt grün):** in `/admin/layout` je Gruppe Ausrichtung (`style: row`), `columns` (nur bei row aktiv) und Checkboxen `header`/`initiallyCollapsed`/`useEqualHeights`; global `maxGroupColumns` (4–8, schreibt Top-Level, entfernt `fiveColumns`). Felder werden **in place** ergänzt/geändert (andere Optionen, Kommentare, `providers` byte-gleich erhalten), Default-Wechsel **löscht** das Feld (leert `style`→ auch `columns`), Eintrag bleibt solange noch Optionen da sind. Save schreibt korrektes YAML + Backup; Disk unverändert bis Save; Dashboard rendert die Layout-Optionen fehlerfrei. `setGroupLayoutField` lehnt Skalar-`layout:` und bare `{{HOMEPAGE_*}}` ab. **Hinweis:** stale `.next`-Cache nach Edits führte zu hängendem „Loading…" → `rm -rf .next` + Server-Neustart behob es (Doku-Hinweis weiter unten).

Kleinere Beobachtung (kein Bug): Bookmark-Cards im 3-Spalten-Raster wirken auf breiten Screens schmal (Name/URL truncaten stark) — rein kosmetisch, read-only.

**Hinweis für künftige Browser-Verifikationen:** Vor einem erneuten `pnpm dev`-Start immer sicherstellen, dass Port 3000 frei ist bzw. alte `next`-Prozesse beendet wurden (`pkill -f next`, dann Port prüfen). Sonst belegt ein alter Server den Port weiter, der neue Start scheitert mit `EADDRINUSE`, und Requests treffen weiterhin den alten Server mit anderen Env-Werten. **Zusätzlich:** Wenn die Editor-Seite hängt (loadState „Loading…") oder dynamische API-Routes eine **Next-404-HTML** statt JSON liefern, liegt meist ein **stale `.next`-Build-Cache** vor → Server stoppen, `rm -rf .next`, neu starten.

### Verifikationsstatus (M7 Auth/Rollen, 2026-05-31)

Per Vitest/Lint, Component-Tests und lokale HTTP-Smoke-Checks gegen `pnpm dev` mit gesetztem
`HOMEPAGE_SESSION_SECRET` geprüft:

- Ohne Session redirectet `/` nach `/login`; bei fehlendem `users.yaml` führt der Flow weiter nach `/setup`; der erste Admin wird angelegt und direkt eingeloggt.
- Admin sieht Dashboard, Admin-Link und `/admin/config`; Save funktioniert ohne Token-Feld/Authorization-Header und legt Backups an.
- Viewer sieht Dashboard, aber keinen Admin-Link; `/admin/*` redirectet clientseitig; Raw-Config-GET/POST liefert für Viewer 403 und ohne Cookie 401.
- Logout zerstört die Session und führt zurück zu `/login`.

### Verifikationsstatus (M8 Theming, 2026-05-31)

`pnpm lint` + `pnpm test` grün (545 Testdateien / 1588 Tests). Neue Unit-Tests: `css-writer.test.js` (6), `yaml-edit.test.js` +10 Background-Helfer.

- **`/admin/theme`** erreichbar für Admin; Nav-Tab „Theme" in allen Admin-Seiten sichtbar.
- **Presets:** 25 Karten, jede mit Farbvorschau-Balken + Dark/Light-Badge; Aktiv-Markierung via `border-blue-500`.
- **Farbpalette:** 34 Farben (inkl. 11 neue Custom-Farben), alle visuell in Grid mit Skalierung auf Auswahl.
- **Hell/Dunkel-Toggle**, **Card-Blur-Dropdown** schreiben via yaml-edit in `settings.yaml`.
- **Hintergrund:** URL-Eingabe + Datei-Upload (base64, max. 10 MB, Vorschau), Regler Deckkraft/Blur/Sättigung/Helligkeit.
- **Custom CSS:** Textarea + Backup-Write via `css-writer.js`.
- **Export:** JSON ohne `background.image` und ohne Secrets. **Import:** JSON → sofort auf State anwenden.
- Dashboard-Farbwechsel durch Pager grün, `settings.yaml` korrekt mutiert.

### Verifikationsstatus (M7b/8g Nachtrag, 2026-06-01)

Per Code-/Test-Stand bestätigt:

- **M7b User-Management-UI umgesetzt:** `/admin/users`, `/api/users`, `src/utils/config/users.js` mit `updateUser`/`deleteUser`/`setUserPassword` sowie Tests für API, Seite und User-Store vorhanden. Leitplanken erfüllt: `users.yaml` bleibt außerhalb `EDITABLE_CONFIGS`, API gibt keine Passwort-Hashes zurück, letzter Admin ist geschützt.
- **8g Presets entschärft umgesetzt:** `THEME_PRESETS` in `src/utils/config/theme-presets.js` nutzt gedämpfte/pastellige Farben; `src/utils/styles/themes.test.js` prüft Preset-Farben gegen `ALL_COLORS` und gültige Theme-Paletten.

### Verifikationsstatus (M18 Config-Health v1, 2026-06-01)

`pnpm test` grün (551 Testdateien / 1640 Tests). Gezielt ergänzt:

- **Config-Health-Utility:** `src/utils/config/config-health.js` mit Unit-Tests für minimale Configs, YAML-Syntaxfehler inkl. Zeile/Spalte, fehlende/duplizierte URLs, unbekannte Access-Gruppen, Secret-Leak-Vermeidung, Homepage-Platzhalter sowie Settings-Checks (`layout`, `maxGroupColumns`, `theme`, `color`).
- **API:** `/api/config/health` ist Admin-only; `GET` prüft alle editierbaren Config-Dateien, `POST` prüft den aktuellen Editor-Text und lehnt nicht editierbare Dateien ab.
- **UI:** `/admin/health` lädt die Gesamtprüfung und filtert nach `All`/`Errors`/`Warnings`/`Info`; `ConfigEditor` hat einen `Health check`-Button mit einklappbarer Ergebnisliste. Health-Meldungen blockieren Save nicht.

### Verifikationsstatus (M19 Service-Widgets per UI, 2026-06-02)

`pnpm test` grün (552 Testdateien / 1651 Tests), `pnpm build` grün. Gezielt ergänzt:

- **Service-Widget-Registry:** `src/utils/config/service-widget-templates.js` enthält die 40 gewünschten Widget-Typen; Tests prüfen Vollständigkeit, eindeutige Typen, gültige Labels und vorhandene Registrierung in `src/widgets/components.js`.
- **YAML-Helfer:** `updateServiceWidget`/`deleteServiceWidget` in `yaml-edit.js` setzen/entfernen `widget:` kommentererhaltend direkt am Service. Nicht-sensitive leere Felder werden entfernt; Secret-Felder bleiben bei leerem Wert erhalten; `[redacted]` wird nie geschrieben; bare unquoted `{{HOMEPAGE_*}}` bleibt für strukturierte Edits gesperrt.
- **UI:** `/admin/config` zeigt Widget-Badges in der Service-Preview und erweitert den Service-Edit-Dialog um „Enable service widget", Typ-Auswahl, kuratierte Formularfelder, vorgeschlagene `fields` und Raw-YAML-Hinweis für Sonderoptionen. Bestehende unbekannte Widget-Optionen bleiben erhalten; Dashboard-Render-Pfad unverändert.
- **Browser-Sichtprüfung:** temporärer Dev-Server mit isolierter Config zeigte `/admin/config`, Service-Dialog und alle 40 kuratierten Typen. Die In-App-Browser-Eingabe war durch dessen Clipboard-Sandbox eingeschränkt; die YAML-Mutation ist über Unit-Tests abgedeckt.

### Verifikationsstatus (M21 Icon-/Favicon-Helfer, 2026-06-02)

`pnpm test` grün (555 Testdateien / 1662 Tests), `pnpm build` grün. Gezielt ergänzt:

- **Icon-Vorschlagslogik:** `src/utils/config/icon-suggestions.js` normalisiert Service-Namen, Hostnamen, Widget-Typen und bestehende Icons; prüft `homarr-labs/dashboard-icons` per `svg`/`webp`/`png`; ergänzt `sh-*`/`si-*`; erkennt Favicons über `/favicon.ico` und HTML-Icon-Links. Lookup ist best-effort mit Timeout und fällt auf lokale Syntax-Vorschläge zurück.
- **API:** `/api/config/icon-suggestions` ist Admin-only, akzeptiert nur `name`, `href`, `widgetType`, `currentIcon` und gibt bei Lookup-Fehlern eine leere Vorschlagsliste statt 500 zurück. Secrets/Roh-YAML werden nicht angenommen oder ausgegeben.
- **UI:** `/admin/config` ergänzt das bestehende `Icon`-Feld im Service-Dialog um „Find icon"; Vorschläge zeigen Quelle/Grund/Vorschau via `ResolvedIcon`; Auswahl schreibt nur den Icon-Wert ins Formular. Save bleibt manuell über die bestehende Config-Editor-Shell.

### Verifikationsstatus (M19b + UI-Nachträge, 2026-06-02)

Volltest nach M19b: `pnpm test -- --runInBand` grün (556 Testdateien / 1672 Tests), `pnpm build` grün. Danach gezielte Nachtests für UI-Finishing und Layout-Erweiterungen grün.

- **Service-Widget-Schema:** `service-widget-templates.js` enthält `allowedFields`/`defaultFields`/`maxFields` und Validierungslogik. `/admin/config` zeigt `fields` als Checkboxen; ungültige oder zu viele Fields werden abgefangen und nicht stillschweigend entfernt.
- **Info-Widget-UI:** `info-widget-templates.js` schematisiert `datetime`, `greeting`, `logo`, `openmeteo`, `resources`, `search`. `/admin/widgets` kann bekannte Info-Widgets hinzufügen/bearbeiten/löschen/umsortieren; unbekannte Widgets bleiben erhalten und über Raw-YAML editierbar. YAML-Helfer schreiben Boolean-/Number-Werte typisiert.
- **UI-Nachträge:** Service-Widget-Blöcke übernehmen `--card-radius`; der Service-Dialog ist breiter (`max-w-3xl`) und Icon-Vorschläge passen besser in den Dialog; `/admin/layout` kann Tabs per ▲/▼ selbst sortieren; Dashboard-Tabs sind mobil kompakter und behalten saubere Rundungen.
- **Gezielte Checks:** Service-/Info-Widget-Registry + `yaml-edit` (104 Tests), `block.test.jsx`, `tab.test.jsx`, Prettier-Checks, `pnpm build` und Browser-Smokes für `/admin/widgets`, `/admin/config`, `/admin/layout` und mobile Dashboard-Tabs.

### Verifikationsstatus (M20 Import-Assistent, 2026-06-02)

Gezielte Tests und Build grün; ein erneuter Volltest wurde nach M20 wegen Kontingent nicht ausgeführt.

- **Homepage-Import v1:** `services.yaml`, `bookmarks.yaml`, `widgets.yaml`, kuratierte `settings.yaml`-Keys und `docker.yaml` werden geparst, konfliktgeprüft und als Editor-Drafts bereitgestellt.
- **Muximux-Import v2:** aktive Apps, Gruppen/Reihenfolge, Collapse-Status, einfache Theme-/Spracheinstellungen, Icon-Mapping, `siteMonitor`, `target`, `access.groups` und Docker-Discovery werden übernommen; deaktivierte oder nicht abbildbare Einträge erzeugen Warnungen statt stiller Migration.
- **Secret- und Save-Verhalten:** Preview liefert keine Rohimporte zurück; `includeSecrets=false` ersetzt Widget-Secrets durch `{{HOMEPAGE_VAR_*}}`; `[redacted]` wird nie geschrieben. Apply speichert nur Session-Drafts, kein direkter Disk-Write.
- **Gezielte Checks:** Import-Assistent, `config-writer`, Admin-Tabs und Import-Draft-Flow per Vitest (M20-Grundschnitt: 5 Dateien / 20 Tests; Muximux-v2-Nachtest: 3 Dateien / 14 Tests), `pnpm build` und `git diff --check` grün.

## Vorgemerkte spätere Komfort-Features

Detail-Backlog und Spezifikationssammlung für spätere Ausbaustufen. Einige Punkte sind inzwischen als Meilensteine in der Roadmap geführt; die Detail-Bullets bleiben als spätere Ausgestaltung erhalten. Es gelten durchgängig die **Leitplanken** am Ende dieses Abschnitts.

> **Hinweis:** Backup/Restore, Audit-Log, Service-Widgets, Import-Assistent, Icon-/Favicon-Helfer, Config-Health-Checks, Mobile-Optimierung, Such-/Filter und Service-Test werden inzwischen als Meilensteine **M9/M11/M16/M17/M18/M19/M20/M21** geführt. M20 deckt aktuell Homepage-YAML und Muximux ab; Homarr, Dashy, Browser-Bookmarks, Docker-Compose, Uptime-Kuma, Traefik und NPM bleiben spätere Importquellen. Die folgenden Detail-Bullets bleiben als deren Spezifikation bzw. spätere Ausgestaltung erhalten.

### Backup-/Restore-UI

- vorhandene Backups aus `CONF_DIR/.backups/` anzeigen
- Backup ansehen
- Diff zwischen aktueller Datei und Backup anzeigen
- Backup wiederherstellen
- Backup herunterladen
- Wiederherstellung nur nach Bestätigung

### Icon- und Favicon-Helfer

- Favicon aus URL ermitteln (**M21 v1 umgesetzt**)
- passende Icons aus [homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons/) vorschlagen (**M21 v1 umgesetzt**); KI/freie Websuche bleibt später optional
- lokale Icons nutzen
- Icon-Vorschau anzeigen (**M21 v1 umgesetzt**)
- dashboard-icons durchsuchen (**M21 v1 kuratiert/heuristisch umgesetzt**)
- Icons optional lokal cachen
- fehlende Icons oder ungültige Icon-Pfade markieren

### Import-Assistent

- Import aus Homepage-YAML (**M20 v1 umgesetzt**)
- Import aus Muximux-Konfiguration (**M20 v2 umgesetzt**)
- Import aus Mafl-Konfiguration
- Import aus Homarr-Export, Dashy, Browser-Bookmarks, Docker-Compose, Uptime-Kuma, Traefik und NPM (**später geparkt**)
- Vorschau vor Übernahme (**M20 umgesetzt**)
- Duplikaterkennung (**M20 umgesetzt**)
- Secrets nie ungeprüft im Klartext importieren (**M20 umgesetzt; weitere Quellen später erneut prüfen**)

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
