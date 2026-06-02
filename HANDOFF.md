# Übergabe / Handoff — homepage-Kito

Stand: HEAD `6f7a8958` auf `main` (== `origin/main`). Diese Datei ist die kompakte Übergabe für die
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
- **pnpm only.** Vor jedem Commit: `pnpm lint` (0 Fehler) **und** `pnpm test` (aktuell **1662** grün).
- Tests neben dem Code als `*.test.{js,jsx}` (Vitest, `vi.mock`/`vi.hoisted`).
  FS/YAML nur serverseitig in `src/utils/config/`. Secrets nie in Preview/Logs/Export.
- Import-Aliase: `components`, `pages`, `styles`, `utils`, `widgets`, `test-utils` (`baseUrl: ./src/`).

## Tech-Stack
Next.js 16 (Pages Router, `output: "standalone"`, SSG via `getStaticProps`), React 19, Tailwind v4,
next-i18next, eemeli `yaml` (kommentarerhaltend, Document-API), iron-session, js-yaml, winston, Vitest.

## Repo-Stand
Repo `Lagrosso/homepage-Kito`, Branch **`main`**, HEAD **`6f7a8958`**, lokal == `origin/main` (gepusht).

## Seit der letzten Übergabe umgesetzt
1. **M8 Theming komplett** (`/admin/theme`): Presets, Hintergrund-Upload, visueller Editor,
   Custom-CSS-Editor, Import/Export.
2. **Ruhige Farbpalette:** Farbpicker kuratiert auf gedämpfte/pastellige Töne
   (`ALL_COLORS` in `utils/config/theme-presets.js`); 10 neue entsättigte Paletten in
   `src/styles/theme.css` **und** `src/utils/styles/themes.js`. Schrille Farben bleiben definiert.
3. **Ecken-Rundung** global (`settings.cardRadius`): CSS-Var `--card-radius` via
   `/api/config/theme-vars` + `_app.jsx`; CSS in `globals.css` (Karten, Such-Box, Admin-Buttons, Tabs).
   Shared Map: `utils/styles/card-radius.js`.
4. **Font** JetBrains Mono (self-hosted `@fontsource-variable/jetbrains-mono`); Manrope entfernt.
5. **Admin-Nav vereinheitlicht** (flache Unterstrich-Tabs, `config-editor.jsx`).
6. **DnD-Fix + Gruppen-Reihenfolge:** pointer-basierte Kollisionserkennung (`dndCollisionDetection`);
   Gruppen-Reihenfolge wird über `settings.yaml` `layout:` gesteuert → neue Helfer
   `moveLayoutGroup`/`moveLayoutGroupToIndex` (`yaml-edit.js`) + ▲/▼ in `/admin/layout`.
   Service-/Bookmark-Vorschau blendet Gruppen-Reorder aus, wenn ein Layout governt
   (`components/admin/use-layout-governs.js`) und zeigt einen Hinweis-Link.
7. **Add-Service-Dialog:** Beschreibungsfeld auch im Add-Modus (`config.jsx`, `yaml-insert.js`).
8. **Docker-Deployment** (siehe unten).
9. **M7b User-Management-UI:** `/admin/users` + Admin-only `/api/users` zum Anlegen, Bearbeiten,
   Löschen und Passwort-Zurücksetzen von Nutzern; `users.yaml` bleibt außerhalb des Raw-Editors,
   Passwort-Hashes werden nie zurückgegeben, letzter Admin ist geschützt.
10. **8g Presets entschärft:** `THEME_PRESETS` nutzt gedämpfte/pastellige Farben aus der kuratierten
    Palette; Test deckt Preset-Farben gegen `ALL_COLORS` und gültige Paletten ab.
11. **M18 Config-Health v1:** statische read-only Health-Checks für `services.yaml`, `bookmarks.yaml`,
    `widgets.yaml`, `settings.yaml`; Admin-only `/api/config/health`, neue Seite `/admin/health` mit
    Severity-Filtern und `Health check`-Button in den bestehenden Config-Editoren. Keine Netzwerkchecks,
    keine Auto-Fixes, Save bleibt nur durch YAML-Syntax blockiert. `pnpm test` grün: 551 Dateien / 1640 Tests.
12. **M19 Service-Widgets per UI:** `/admin/config` erweitert den Service-Edit-Dialog um „Enable service widget"
    für 40 kuratierte Homepage-Service-Widgets. Neue Registry `src/utils/config/service-widget-templates.js`;
    neue YAML-Helfer `updateServiceWidget`/`deleteServiceWidget`; secret-aware (leer = bestehende Secrets
    behalten, `[redacted]` nie schreiben, Platzhalter sichtbar). Unbekannte Widget-Optionen bleiben erhalten;
    Dashboard-Render-Pfad bleibt unverändert. `pnpm test` grün: 552 Dateien / 1651 Tests; `pnpm build` grün.
13. **M21 Icon-/Favicon-Helfer:** `/admin/config` erweitert das Service-Icon-Feld um „Find icon".
    Admin-only `/api/config/icon-suggestions` nutzt `src/utils/config/icon-suggestions.js` für kuratierte
    Vorschläge aus `homarr-labs/dashboard-icons`, `sh-*`/`si-*`-Syntax und Favicons aus Service-URLs.
    Auswahl schreibt nur ins Formular, Save bleibt manuell; keine freie Websuche, keine lokalen Bilddownloads,
    keine Credential-Tests. `pnpm test` grün: 555 Dateien / 1662 Tests; `pnpm build` grün.

Hinweis zur Doku: `AGENTS.md` wurde mit diesen Nachträgen ergänzt, damit Codex denselben Projektstand
wie diese Übergabe sieht.

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

**Phase 2 (read-only/config-only, Top ★🔥):** M9 (Status/Health pro Dienst), M17 (Backup/Restore/Rollback),
M10 (Profile/Ansichts-Modi), M11 (Command Palette),
M14 (Multi-URL/Safe-Links), M16 (Mobile/PWA). Ergänzend M12/M13/M15/M20 (Import-Assistent); M21
(Icon-/Favicon-Helfer) ist umgesetzt.

**Phase 3 (Vision, erst nach Auth/Audit):** M22–M27 (Service-Aktionen, Autodiscovery, Setup-Assistent,
Wartungszentrale, Notfall-Ansicht, Netzwerk-Überblick).

## Verifikation
```bash
pnpm lint && pnpm test          # muss grün sein (1662 Tests)
docker build -t homepage-kito:test .   # fängt next-build-Fehler ab
```
