# Übergabe / Handoff — homepage-Kito

Stand: HEAD `464fa4b1` auf `main` (gepusht); zuletzt UI-Fixes (cardRadius/Dropdown) + `tmp`-Override, davor Sicherheits-Patch (kritische Deps + vitest 3→4).
Diese Datei ist die kompakte Übergabe für die
Fortsetzung der Arbeit (z. B. durch Codex). Die ausführliche Roadmap + Verifikationsstatus stehen in
**`CLAUDE.md`**; **`AGENTS.md`** ist die für Codex synchronisierte Arbeitsanweisung. Bei Widerspruch
zwischen Doku und Code gilt der aktuelle Code-Stand.

## Projektkontext
`homepage-Kito` ist ein **eigenständiger Fork** von gethomepage/homepage (GPLv3), der das
YAML-konfigurierte Self-Hosted-Dashboard schrittweise um eine **UI-gestützte Konfiguration**
(Admin-Bereich) erweitert. YAML bleibt **Quelle der Wahrheit**; der bestehende Render-/Lese-Pfad bleibt
unangetastet; neue Features sind additiv und standardmäßig deaktiviert.

## Projektregeln (zwingend)
- **Kommunikation auf Deutsch**, Code/Identifier/Commit-Messages Englisch.
  Commit-Trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **pnpm only.** Vor jedem Commit: `pnpm lint` (0 Fehler) **und** `pnpm test`. Letzter vollständiger
  Stand: **564 Dateien / 1721 Tests** grün (unter **vitest 4**). `pnpm lint` ist auf `eslint src`
  gescopt (nicht `eslint .`). Dependency-**Overrides** liegen in `pnpm-workspace.yaml` (pnpm v11 liest
  `package.json` `pnpm.overrides` **nicht** mehr).
- Tests neben dem Code als `*.test.{js,jsx}` (Vitest, `vi.mock`/`vi.hoisted`).
  FS/YAML nur serverseitig in `src/utils/config/`. Secrets nie in Preview/Logs/Export.
- Import-Aliase: `components`, `pages`, `styles`, `utils`, `widgets`, `test-utils` (`baseUrl: ./src/`).

## Tech-Stack
Next.js 16 (Pages Router, `output: "standalone"`, SSG via `getStaticProps`), React 19, Tailwind v4,
next-i18next, eemeli `yaml` (kommentarerhaltend, Document-API), iron-session, js-yaml, winston, Vitest.

## Repo-Stand
Repo `Lagrosso/homepage-Kito`, Branch **`main`**, HEAD **`464fa4b1`**.

Aktuell sichtbar im Worktree:

- untracked Fremdeintrag `codex-desktop-linux` — **nicht Teil der Arbeit**, nicht anfassen ohne Anlass
- diese Doku-Datei plus `CLAUDE.md`/`AGENTS.md` können lokal von der letzten Übergabe-Aktualisierung abweichen

## Seit der letzten Übergabe umgesetzt

### M17 – History / Restore / Änderungsverlauf
- **Ziel:** Backups nicht nur schreiben, sondern sichtbar, diffbar und restorebar machen, ohne das
  bestehende Draft-/Save-Sicherheitsmodell aufzugeben.
- **Funktional umgesetzt:**
  - neue Admin-Seite `/admin/history`
  - Liste, Detail, Diff, Download und Draft-first-Restore für `services.yaml`, `bookmarks.yaml`,
    `widgets.yaml`, `settings.yaml`, `docker.yaml` und `custom.css`
  - JSONL-History zusätzlich zu bestehenden `.bak`-Dateien
  - Restore lädt nur einen Draft; Live-Write passiert weiterhin erst beim normalen Save
  - `Change comment` in `/admin/config` und `/admin/theme`
- **Wichtige Dateien:**
  - `src/utils/config/backup-history.js`
  - `src/utils/config/config-writer.js`
  - `src/utils/config/css-writer.js`
  - `src/utils/config/import-drafts.js`
  - `src/pages/api/config/history/index.js`
  - `src/pages/api/config/history/[id].js`
  - `src/pages/api/config/history/[id]/diff.js`
  - `src/pages/api/config/history/[id]/download.js`
  - `src/pages/api/config/history/[id]/restore.js`
  - `src/pages/admin/history.jsx`
  - `src/components/admin/config-editor.jsx`
  - `src/pages/admin/theme.jsx`
- **Verifikation:** `pnpm test`, `pnpm build`, `git diff --check` grün; Stand damals
  **561 Dateien / 1701 Tests**.

### M18 – Config-Health v1
- **Ziel:** statische Qualitäts- und Sicherheitschecks für die editierbaren YAML-Dateien direkt in der Admin-UI.
- **Funktional umgesetzt:**
  - neue Admin-Seite `/admin/health`
  - Admin-only API `/api/config/health`
  - `Health check`-Button in den Config-Editoren
  - Prüfungen u. a. auf YAML-Shape, duplizierte/fehlende URLs, ungültige `access.groups`,
    Klartext-Secrets, Layout-/Theme-Auffälligkeiten
  - keine Netzwerkchecks, keine Auto-Fixes, Save nur durch YAML-Syntax blockiert
- **Wichtige Dateien:**
  - `src/utils/config/config-health.js`
  - `src/pages/api/config/health.js`
  - `src/pages/admin/health.jsx`
  - `src/components/admin/config-editor.jsx`
  - zugehörige Tests in `src/utils/config/config-health.test.js` und Page-Tests
- **Verifikation:** `pnpm test` grün; Stand damals **551 Dateien / 1640 Tests**.

### M19 – Service-Widgets per UI
- **Ziel:** kuratierte Homepage-Service-Widgets direkt im Service-Dialog anlegen/bearbeiten/löschen.
- **Funktional umgesetzt:**
  - Widget-Bereich im Service-Edit-Dialog unter `/admin/config`
  - Aktivieren/Deaktivieren von `widget:`
  - Auswahl aus 40 kuratierten Service-Widget-Typen
  - Secret-aware Verhalten: echte Secrets nie vorbefüllt, leer = behalten, `[redacted]` nie schreiben
  - unbekannte Widget-Optionen bleiben erhalten, Raw-YAML bleibt für Sonderfälle möglich
- **Wichtige Dateien:**
  - `src/utils/config/service-widget-templates.js`
  - `src/utils/config/yaml-edit.js`
  - `src/pages/admin/config.jsx`
  - `src/components/admin/service-form-dialog.jsx`
  - `src/components/admin/config-editor.jsx`
  - zugehörige Registry-/YAML-/UI-Tests
- **Verifikation:** `pnpm test` und `pnpm build` grün; Stand damals
  **552 Dateien / 1651 Tests**.

### M19b – Widget-Schema & Info-Widget-UI
- **Ziel:** M19 von groben Feldern auf echtes Schema heben und `/admin/widgets` für Info-Widgets strukturiert machen.
- **Funktional umgesetzt:**
  - `fields` für Service-Widgets als Checkboxen mit `allowedFields`/`defaultFields`/`maxFields`
  - Max-Validierung im UI
  - neue Info-Widget-Registry für `datetime`, `greeting`, `logo`, `openmeteo`, `resources`, `search`
  - `/admin/widgets` kann bekannte Info-Widgets hinzufügen, bearbeiten, löschen und umsortieren
  - Boolean-/Number-Werte werden typisiert in YAML geschrieben
- **Wichtige Dateien:**
  - `src/utils/config/service-widget-templates.js`
  - `src/utils/config/info-widget-templates.js`
  - `src/utils/config/yaml-edit.js`
  - `src/pages/admin/widgets.jsx`
  - `src/components/admin/config-editor.jsx`
  - `src/components/admin/widget-form-dialog.jsx`
  - zugehörige Schema-/YAML-/Page-Tests
- **Verifikation:** Volltest nach M19b grün; Stand damals **556 Dateien / 1672 Tests**.

### M20 – Import-Assistent
- **Ziel:** bestehende Konfigurationen übernehmen, aber weiterhin nur als Draft in die Editor-Shell schreiben.
- **Funktional umgesetzt:**
  - neue Admin-Seite `/admin/import`
  - Preview-/Apply-APIs
  - Import v1 für Homepage-YAML (`services.yaml`, `bookmarks.yaml`, `widgets.yaml`, kuratierte
    `settings.yaml`-Keys, `docker.yaml`)
  - Import v2 für Muximux
  - Apply schreibt nur Drafts; Save/Validate/Backup bleiben manuell
  - Secret-Verhalten: Vorschau ohne Rohimporte; ohne Secret-Übernahme werden Widget-Secrets als
    `{{HOMEPAGE_VAR_*}}` geschrieben
  - weitere Quellen wie Homarr, Dashy, Browser-Bookmarks, Docker-Compose, Uptime-Kuma, Traefik und NPM
    bewusst verschoben
- **Wichtige Dateien:**
  - `src/pages/admin/import.jsx`
  - `src/pages/api/config/import/preview.js`
  - `src/pages/api/config/import/apply.js`
  - `src/utils/config/import-assistant.js`
  - `src/utils/config/import-drafts.js`
  - `src/utils/config/config-writer.js`
  - `src/components/admin/config-editor.jsx`
  - zugehörige Import-/Draft-/Auth-Tests
- **Verifikation:** gezielte Tests + `pnpm build` + `git diff --check` grün; zusätzlich
  Muximux-v2-Nachtest separat grün.

### M21 – Icon- und Favicon-Helfer
- **Ziel:** Service-Icons im Config-Dialog kuratiert vorschlagen statt nur manuell eintippen.
- **Funktional umgesetzt:**
  - „Find icon“-Button im Service-Dialog
  - Admin-only API `/api/config/icon-suggestions`
  - Vorschläge aus `homarr-labs/dashboard-icons`, `sh-*`, `si-*` und Favicons der Ziel-URL
  - Auswahl schreibt nur ins Formular; Save bleibt manuell
  - keine freie Websuche, keine lokalen Bilddownloads, keine Credential-Tests
- **Wichtige Dateien:**
  - `src/utils/config/icon-suggestions.js`
  - `src/pages/api/config/icon-suggestions.js`
  - `src/components/admin/service-form-dialog.jsx`
  - `src/components/resolvedicon.jsx` bzw. bestehender Render-Pfad für Vorschau
  - zugehörige API-/Utility-/UI-Tests
- **Verifikation:** `pnpm test` und `pnpm build` grün; Stand damals
  **555 Dateien / 1662 Tests**.

### UI-/Layout-/Theme-Nachträge rund um M19–M21
- **Zusätzlich gemeinsam umgesetzt:**
  - Service-Widget-Blöcke übernehmen `--card-radius`
  - Service-Dialog breiter (`max-w-3xl`) für Icon-Vorschläge
  - `/admin/layout` kann Tabs per ▲/▼ selbst sortieren (`moveLayoutTab`)
  - Dashboard-Tabs mobil kompakter und sauber gerundet
  - globale Gruppen-Reihenfolge läuft über `settings.yaml` `layout:`
  - irreführendes Gruppen-Reorder wird bei layout-gesteuerter Reihenfolge ausgeblendet
- **Wichtige Dateien:**
  - `src/pages/admin/layout.jsx`
  - `src/utils/config/yaml-edit.js`
  - `src/components/admin/use-layout-governs.js`
  - `src/styles/globals.css`
  - `src/pages/_app.jsx`
  - `src/utils/styles/card-radius.js`

### M9 – Service-Status & Health v1
- **Ziel:** bestehende Statussignale operativ nutzbar machen, ohne neue aktive Checks einzuführen.
- **Funktional umgesetzt:**
  - neue serverseitige Status-Aggregation
  - read-only API `/api/services/status`
  - Dashboard-Filter „All services“ / „Problematic only“
  - `/admin/health` um zweiten Bereich „Service Status“ ergänzt
  - `ping` und `siteMonitor` markieren Antworten ab `1000 ms` als Warning/`slow`
  - keine Runtime-Aktionen, kein Verlauf, keine Zusatzprobes
- **Wichtige Dateien:**
  - `src/utils/config/service-status.js`
  - `src/pages/api/services/status.js`
  - `src/pages/index.jsx`
  - `src/pages/admin/health.jsx`
  - `src/components/services/ping.jsx`
  - `src/components/services/site-monitor.jsx`
  - `src/utils/config/service-status.test.js`
  - `src/__tests__/pages/api/services/status.test.js`
  - `src/__tests__/pages/admin-health.test.jsx`
  - `src/__tests__/pages/index.test.jsx`
  - `src/components/services/ping.test.jsx`
  - `src/components/services/site-monitor.test.jsx`
- **Verifikation:** `pnpm test`, `pnpm build`, `git diff --check` grün; Stand
  **563 Dateien / 1710 Tests**.

### Re-Verifikation & Härtung M9/M17/M20/M21 (2026-06-04, Commit `4b3e5923`)
- **Verifikation:** `pnpm test` **564 / 1721** grün, `pnpm build` grün, `pnpm lint` 0 Fehler, `git diff --check` sauber.
- **Statisches Leitplanken-Review:** M17 Download/Restore admin-gated + Traversal-Guard (`id` nur gegen
  bestehenden History-Index aufgelöst); M9 `/api/services/status` rollen-/sichtbarkeitsgefiltert; M20
  `apply`/`preview` admin-gated und Draft-first (kein direkter Disk-Write); M21 admin-gated, Input begrenzt,
  Fehler → leere Liste. **Bewusst keine SSRF-„Härtung"** beim Favicon-Fetch (würde legitime LAN-IP-Ziele brechen).
- **Fix (M9 slow-Robustheit):** stabiles `slow`-Boolean ersetzt `detailLabel.includes("slow")`
  (`service-status.js` ×2, `admin/health.jsx`) → Filter bricht nicht mehr bei geänderten/lokalisierten Labels.
- **Fix (M9 i18n):** Dashboard-Filter + `slow`-Badges über next-i18next (`serviceStatus.*`, `ping.slow`,
  `siteMonitor.slow`); `/admin/health` bleibt englisch (Admin-Konvention).
- **Testlücke geschlossen:** neuer `src/utils/config/import-drafts.test.js` (11 Fälle) für den Draft-Store
  (M17-Restore + M20-Apply).
- **Lint-Papercut:** `pnpm lint` → `eslint src` (der untracked Fremdordner `codex-desktop-linux` erzeugte
  zuvor ~550 Falsch-Fehler + Exit 1).
- **Sicherheitslage (`pnpm audit`):** die hier gelisteten kritischen Funde (`form-data`, `fast-xml-parser`,
  `vitest`) sowie `glob` sind mit Commit `ccd6eda4` **gepatcht** (siehe Abschnitt „Sicherheits-Patch" oben).
  Dependabot-API im Repo deaktiviert, daher `pnpm audit` als Quelle.

### Sicherheits-Patch: kritische Deps + vitest 3→4 (2026-06-08, Commit `ccd6eda4`)
- **Ziel:** alle **kritischen** `pnpm audit`-Funde beseitigen (priorisierter Backlog-Punkt).
- **Umgesetzt:**
  - Overrides in `pnpm-workspace.yaml` (pnpm v11): `form-data <4.0.4 → ^4.0.4` (via `@kubernetes/client-node`),
    `fast-xml-parser <5.3.5 → ^5.3.5` (via `gamedig`), `glob >=10.2.0 <10.5.0 → ^10.5.0`.
  - `vitest` + `@vitest/coverage-v8` → `^4.1.8` (Major; coverage-v8 peer-pinnt vitest exakt).
  - **vitest-4-Test-Fixes (nur Test-Mocks, Produktionscode unverändert):** Arrow-`vi.fn()`-Mocks sind in
    vitest 4 **nicht konstruierbar**. Resources-Widget-Tests: `Error`-Mock → `ErrorWidget` umbenannt
    (überschattete global `Error` bei `new Error()`); `Docker`/`UrbackupServer`-Mocks auf `function`-Form;
    `config-editor.auth`-Save/Health-Test mit `waitFor`-Timeout gegen Vollsuite-Last-Flake gehärtet.
- **Verifikation:** `pnpm test` **564 / 1721** grün, `pnpm build` grün, `pnpm lint` 0 Fehler,
  `git diff --check` sauber. **`pnpm audit`: 0 kritische** (vorher 1 critical vitest + 2 critical Runtime).
- **`tmp`-Override nachgezogen (Commit `464fa4b1`):** `tmp@<0.2.4 → ^0.2.4` (jetzt 0.2.7) in
  `pnpm-workspace.yaml`; der k8s-Pfad ist gepatcht. `pnpm audit` jetzt **9 Funde (1 low / 2 moderate / 6 high)**.
- **Noch offen (nicht kritisch):** 6× `minimatch`-ReDoS (high, **eslint/typescript-eslint-intern**, dev-only;
  Fix wäre `minimatch@10` = Major-API-Sprung, würde eslint brechen → nicht forciert); `postcss` XSS
  (moderate, via `next`) und `uuid` (moderate, via `dockerode`) = bundle-/Major-intern, riskant.
- **Minor (vitest-4-Warnung, kein Fehler):** `vi.unmock(...)` nicht auf Top-Level in `favicon.test.jsx` +
  `proxy/http.test.js` → „will become an error in a future version"; bei Gelegenheit nach oben ziehen.

### UI-Fixes bei `cardRadius: full` + Search-Dropdown (2026-06-08, Commit `f6937a6e`)
- **Problem:** Bei `cardRadius: full` (`--card-radius: 9999px`) runden die nur ~36–60px hohen Service-Cards
  so stark, dass ihr `overflow: clip` die Ecken-Badges (`ping`/`siteMonitor`-Latenz, z. B. „421 MS" → „421 .")
  und die innere Widget-API-Error-Bar **anschneidet**. Zusätzlich war der Provider-Dropdown des Search-Widgets
  (`dark:bg-theme-600`, solides Grau) nicht theme-konform.
- **Fix (`src/styles/globals.css` + `src/components/widgets/search/search.jsx`):**
  - `.service-card` Radius auf `min(var(--card-radius), 1.5rem)` geklemmt (+ Error-`<summary>` auf `0.75rem`) —
    selbe Logik wie der bestehende `#myTab`-Clamp; Cards bleiben gerundet, Badges/Error-Bar werden nicht mehr
    beschnitten.
  - Search-Provider-Dropdown auf glasiges `bg-theme-50/95 dark:bg-theme-800/95 backdrop-blur-md` + Border
    (konsistent mit dem Suggestions-Dropdown).
- **Verifikation:** live per CSS-Injection (Badge-Clipping behoben) + `pnpm build` grün, `search.test.jsx` grün,
  Prettier sauber. **Hinweis:** der Dev-Server hat die CSS-Änderung per HMR **nicht** übernommen
  (File-Watch/`.next`-Thema) — für die Live-Vorschau Dev-Server stoppen, `rm -rf .next`, neu starten.

Hinweis zur Doku: `CLAUDE.md` und `AGENTS.md` wurden mit diesen Nachträgen ergänzt, damit Claude/Codex
denselben Projektstand wie diese Übergabe sehen.

## ⚠️ Wichtige Stolperfallen
- **Production-Build bricht an Test-Dateien unter `src/pages/`** (außer `pages/api/**`): `next build`
  behandelt sie als Seite. **Seiten-Tests gehören nach `src/__tests__/pages/`.** Zeigt sich **nur** bei
  `pnpm build`/Docker-Build, nicht bei `pnpm dev`/`test`.
- **Neue Theme-Farbe = zwei Stellen:** `theme.css` (`.theme-<name>` mit `--color-50..900` +
  `--color-logo-start/stop`) **und** `themes.js` (`{light,iconStart,iconEnd,dark}`).
  `src/utils/styles/themes.test.js` erzwingt: jede `ALL_COLORS`-Farbe hat eine Palette. Sonst crasht das
  Dashboard (`themes[color][theme]` undefined).
- **Cookie über HTTP:** `HOMEPAGE_SECURE_COOKIE` (Default `false`) in `session.js`. Über HTTP muss
  `Secure` aus bleiben, sonst kein Login. Nur bei HTTPS auf `true`.
- **Healthcheck:** `/api/healthcheck` muss in `middleware.js` (`isPublicPath`) **vor** der Login-Wall
  bleiben, sonst 401 → Container „unhealthy".
- **Dev-Preview stale `.next`:** wenn eine Route rohes `__NEXT_DATA__`-JSON liefert/hängt →
  Server stoppen, `rm -rf .next`, neu starten. Vor `pnpm dev` Port freimachen (`pkill -f next`).
  `HOMEPAGE_SESSION_SECRET` im Dev-Env nötig.

## Env-Variablen (Auth/Deploy)
| Variable | Default | Zweck |
|---|---|---|
| `HOMEPAGE_SESSION_SECRET` | – | **Pflicht**, ≥32 Zeichen, verschlüsselt das Session-Cookie. |
| `HOMEPAGE_SECURE_COOKIE` | `false` | `Secure`-Flag; nur bei HTTPS `true`. |
| `HOMEPAGE_ALLOWED_HOSTS` | localhost | Erlaubte Host-Header; bei IP/Domain setzen (kommagetrennt) oder `*`. |

## Docker-Deployment (eingerichtet, läuft beim Nutzer)
- **Strategie:** auf dem PC bauen → **Docker Hub (public)** → Server zieht nur.
  Image: **`lagrosso/homepage-kito:latest`**.
- Dateien: `Dockerfile`, `docker-compose.yml` (Server, zieht `${DOCKERHUB_IMAGE}`, kein Build),
  `.env.example`, `scripts/docker-build-push.sh`, **`DOCKER.md`** (vollständige Anleitung).
- Update-Zyklus: PC `./scripts/docker-build-push.sh` → Server `docker compose pull && up -d`.
  Erststart: `/setup` legt ersten Admin an.

## Offene Punkte / nächste Meilensteine (Details in `CLAUDE.md`)
**Klein & naheliegend (vorgemerkt):**
- **Admin-Sammeltab „Alle Services & Bookmarks"** (nur Admins; braucht Render-Pfad-Änderung → gehört zu M10).

**Phase 2 (read-only/config-only, Top ★🔥):** M10 (Profile/Ansichts-Modi), M11 (Command Palette),
M14 (Multi-URL/Safe-Links), M16 (Mobile/PWA). Ergänzend M12/M13/M15. M19/M19b
(Service-/Info-Widgets), M20 (Import-Assistent: Homepage-YAML + Muximux), M21
(Icon-/Favicon-Helfer) sind umgesetzt. Weitere Importquellen bleiben späterer Ausbau.

**Phase 3 (Vision, erst nach Auth/Audit):** M22–M27 (Service-Aktionen, Autodiscovery, Setup-Assistent,
Wartungszentrale, Notfall-Ansicht, Netzwerk-Überblick).

## Verifikation
```bash
pnpm lint && pnpm test          # muss grün sein; letzter Vollstand: 564 Dateien / 1721 Tests
docker build -t homepage-kito:test .   # fängt next-build-Fehler ab
```

M17 wurde vollständig geprüft:

```bash
pnpm test
pnpm build
git diff --check
```

M20 wurde zuvor gezielt geprüft:

```bash
pnpm exec vitest run src/utils/config/import-assistant.test.js src/utils/config/config-writer.test.js src/components/admin/admin-tabs.test.jsx src/components/admin/config-editor.import-draft.test.jsx src/components/admin/config-editor.auth.test.jsx
pnpm exec vitest run src/utils/config/import-assistant.test.js src/utils/config/config-writer.test.js src/components/admin/config-editor.import-draft.test.jsx
pnpm build
git diff --check
```

Dabei waren der M20-Grundschnitt (5 Dateien / 20 Tests), der Muximux-v2-Nachtest (3 Dateien / 14 Tests),
Build und Whitespace-Check grün. Ein erneuter Volltest nach M20 wurde wegen Kontingent nicht ausgeführt.

M9 wurde vollständig geprüft:

```bash
pnpm test
pnpm build
git diff --check
```

Stand dabei:

- **Volltest:** 563 Testdateien / 1710 Tests grün
- **Build:** grün
- **Whitespace-Check:** grün

## Offene Anschlussarbeit für Claude
- M9 ist im Repo-Stand enthalten und re-verifiziert; der M9-UX-Polish (Lokalisierung von `slow`/Filtertexte,
  robuster `slow`-Filter) ist mit Commit `4b3e5923` **erledigt**.
- `codex-desktop-linux` liegt weiter als untracked Fremdeintrag im Worktree und wurde nicht angefasst.
- **Sicherheits-Backlog:** kritische Deps + `glob` + vitest (`ccd6eda4`) und `tmp` (`464fa4b1`) sind
  **erledigt** (0 critical, 9 Funde Rest). **Rest (nicht kritisch, riskant zu forcieren):** `minimatch`
  (high, dev-only eslint-intern), `postcss`/`uuid` (moderate, bundle-/Major-intern). Vorher abwägen.
- Nächster sinnvoller Produkt-Schritt: M10 planen/umsetzen, oder M9 in Browser manuell gegen reale
  Statusquellen durchklicken.
