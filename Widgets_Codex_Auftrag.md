# Codex-Auftrag: Homepage-Kito Widget-Unterstützung sauber implementieren

## Ziel

Bitte erweitere bzw. prüfe die Widget-Unterstützung in diesem Projekt so, dass Homepage/GetHomepage-Service-Widgets und Info-Widgets sauber, validierbar und benutzerfreundlich über die UI verwaltet werden können.

Die aktuelle Grundlage ist eine unsortierte Sammlung von Widget-Typen, erlaubten Feldern und Sonderregeln. Diese Datei ist die bereinigte Arbeitsanweisung für Codex.

---

## Kontext

Das Projekt basiert auf bzw. orientiert sich an **Homepage/GetHomepage**.

Homepage unterscheidet grob zwischen:

1. **Service-Widgets**
   - Werden normalerweise in `services.yaml` unter einem Service konfiguriert.
   - Beispielstruktur:

   ```yaml
   - Medien:
       - Jellyfin:
           href: http://jellyfin.example.local
           icon: jellyfin
           description: Medienserver
           widget:
             type: jellyfin
             url: http://jellyfin.example.local
             key: "{{HOMEPAGE_VAR_JELLYFIN_API_KEY}}"
             fields:
               - movies
               - series
               - episodes
               - songs
   ```

2. **Info-Widgets**
   - Werden normalerweise in `widgets.yaml` konfiguriert.
   - Beispiele: `datetime`, `search`, `openmeteo`, `resources`, `glances`, `greeting`, `logo`.

---

## Hauptaufgabe

Bitte analysiere den bestehenden Code und setze die Widget-Unterstützung so um, dass:

- bekannte Widget-Typen auswählbar sind,
- erlaubte Felder validiert werden,
- maximal erlaubte Feldanzahlen berücksichtigt werden,
- sensible Werte wie API-Keys, Tokens, Benutzername/Passwort nicht ungewollt angezeigt oder überschrieben werden,
- bestehende YAML-Strukturen erhalten bleiben,
- unbekannte oder komplexe Widgets nicht zerstört werden,
- die UI verständliche Eingabefelder anbietet,
- Tests für Parser, Validatoren und YAML-Schreiblogik vorhanden sind.

---

## Wichtige Regeln für die Umsetzung

### 1. YAML darf nicht kaputtgeschrieben werden

Beim Speichern darf die bestehende Struktur nicht unnötig verändert werden.

Insbesondere erhalten bleiben sollen:

- Gruppenreihenfolge
- Servicereihenfolge
- vorhandene `href`, `icon`, `description`, `server`, `container`, `siteMonitor`, `ping`
- unbekannte Felder
- Kommentare, falls die vorhandene YAML-Bibliothek das unterstützt
- Secret-Platzhalter wie `{{HOMEPAGE_VAR_NAME}}`

Wenn Kommentare technisch nicht zuverlässig erhalten werden können, bitte dokumentieren und Tests so schreiben, dass wenigstens die eigentliche Konfiguration erhalten bleibt.

---

### 2. Secrets niemals vorbefüllen

Folgende Werte gelten als sensibel:

- `key`
- `token`
- `apiKey`
- `password`
- `username`, wenn in Kombination mit `password`
- weitere Auth-Felder, die bereits im Projekt als Secret behandelt werden

Regel:

- Secrets in der UI leer anzeigen oder als `[redacted]` markieren.
- Wird ein Secret-Feld leer gespeichert, bleibt der bestehende Wert erhalten.
- Der String `[redacted]` darf niemals in die YAML geschrieben werden.
- Wenn ein Secret aktiv geändert wird, nur dann den neuen Wert schreiben.

---

### 3. Drei Modi für Widget-Bearbeitung

Bitte die Bearbeitung in der UI in drei Fälle aufteilen:

#### A) Bekannter Widget-Typ mit Schema

Beispiel:

```yaml
widget:
  type: jellyfin
  url: http://jellyfin:8096
  key: "{{HOMEPAGE_VAR_JELLYFIN_KEY}}"
  fields:
    - movies
    - series
```

UI soll anbieten:

- Typauswahl
- URL
- Auth-Felder je nach Typ
- erlaubte Felder als Checkboxen oder Multi-Select
- optionale Zusatzfelder, falls bekannt

#### B) Bekannter Widget-Typ, aber komplexe Spezialoptionen

Beispiel: `glances`, `resources`, `openmeteo`, `vikunja`, `jellyfin`.

UI darf einfache Felder anbieten, sollte aber zusätzlich einen „Raw bearbeiten“-Modus erlauben.

#### C) Unbekannter Widget-Typ

Nicht löschen oder verändern.

UI soll anzeigen:

- „Unbekannter oder noch nicht unterstützter Widget-Typ“
- Raw-Ansicht/Bearbeitung anbieten
- Speichern nur mit YAML-Validierung

---

## Service-Widget-Schemas

Bitte daraus eine zentrale Schema-Datei, Registry oder vergleichbare Struktur bauen, damit UI, Validatoren und Tests dieselbe Quelle verwenden.

Empfohlene interne Struktur:

```js
{
  type: "jellyfin",
  label: "Jellyfin",
  allowedFields: ["movies", "series", "episodes", "songs"],
  maxFields: null,
  defaultFields: [],
  requiredOptions: ["url"],
  secretOptions: ["key"],
  optionalOptions: [
    "version",
    "enableBlocks",
    "enableNowPlaying",
    "enableUser",
    "enableMediaControl",
    "showEpisodeNumber",
    "expandOneStreamToTwoRows"
  ],
  supportsRawMode: true
}
```

---

## Unterstützte Service-Widgets und erlaubte Felder

### AdGuard Home

```yaml
type: adguard
fields:
  - queries
  - blocked
  - filtered
  - latency
```

Erlaubte Felder:

- `queries`
- `blocked`
- `filtered`
- `latency`

---

### Audiobookshelf

Erlaubte Felder:

- `podcasts`
- `podcastsDuration`
- `books`
- `booksDuration`

---

### Authentik

Erlaubte Felder:

- `users`
- `loginsLast24H`
- `failedLoginsLast24H`

---

### Beszel

Beszel hat zwei Modi.

#### Übersicht aller Systeme

Wenn kein `systemId` angegeben ist:

- `systems`
- `up`

#### Einzelnes System

Wenn `systemId` angegeben ist:

- `name`
- `status`
- `updated`
- `cpu`
- `memory`
- `disk`
- `network`

Hinweis:

- Für die Beszel-API wird aktuell ein Superuser benötigt.
- `systemId` kann die ID aus PocketBase oder der Anzeigename aus der Beszel-UI sein.

---

### Caddy

Erlaubte Felder:

- `upstreams`
- `requests`
- `requests_failed`

---

### Calibre-Web

Erlaubte Felder:

- `books`
- `authors`
- `categories`
- `series`

---

### Deluge

Erlaubte Felder:

- `leech`
- `download`
- `seed`
- `upload`

---

### Dockhand

Maximal 4 Felder.

Erlaubte Felder:

- `running`
- `stopped`
- `paused`
- `total`
- `cpu`
- `memory`
- `images`
- `volumes`
- `events_today`
- `pending_updates`
- `stacks`

Standardfelder:

- `running`
- `total`
- `cpu`
- `memory`

---

### Fritz!Box

Maximal 4 Felder.

Erlaubte Felder:

- `connectionStatus`
- `uptime`
- `maxDown`
- `maxUp`
- `down`
- `up`
- `received`
- `sent`
- `externalIPAddress`
- `externalIPv6Address`
- `externalIPv6Prefix`

Hinweise:

- Zugang für Anwendungen und UPnP müssen in der Fritz!Box aktiviert sein.
- Zugangsdaten werden normalerweise nicht benötigt.
- HTTP kann schneller sein als HTTPS.

---

### Gitea

Erlaubte Felder:

- `repositories`
- `notifications`
- `issues`
- `pulls`

---

### GitLab

Erlaubte Felder:

- `events`
- `issues`
- `merges`
- `projects`

---

### Glances

Glances ist ein Spezialfall und sollte Raw-Modus unterstützen.

Service-Widget-Beispiel:

```yaml
widget:
  type: glances
  url: http://glances.host.or.ip:port
  username: user
  password: pass
  version: 4
  metric: cpu
  diskUnits: bytes
  refreshInterval: 5000
  pointsLimit: 15
```

Wichtige Optionen:

- `url`
- `username`
- `password`
- `version`
- `metric`
- `diskUnits`
- `refreshInterval`
- `pointsLimit`
- `chart`

Unterstützte `metric`-Werte bzw. Muster:

- `info`
- `cpu`
- `memory`
- `process`
- `containers`
- `network:<interface_name>`
- `sensor:<sensor_id>`
- `disk:<disk_id>`
- `gpu:<gpu_id>`
- `fs:<mnt_point>`

Beispiele:

```yaml
- CPU Usage:
    widget:
      type: glances
      url: http://glances.host.or.ip:port
      metric: cpu
```

```yaml
- Network Usage:
    widget:
      type: glances
      url: http://glances.host.or.ip:port
      metric: network:enp0s25
      chart: false
```

---

### Gotify

Erlaubte Felder:

- `apps`
- `clients`
- `messages`

---

### Grafana

Erlaubte Felder:

- `dashboards`
- `datasources`
- `totalalerts`
- `alertstriggered`

---

### Karakeep

Maximal 4 Felder.

Erlaubte Felder:

- `bookmarks`
- `favorites`
- `archived`
- `highlights`
- `lists`
- `tags`

---

### Home Assistant

Der Widget-Typ soll als bekannter Typ geführt werden.

Da in der Ausgangsdatei keine erlaubten Felder angegeben waren:

- nicht hart validieren,
- Raw-Modus anbieten,
- bestehende Konfiguration unverändert erhalten.

---

### iFrame

Der Widget-Typ soll als bekannter Typ geführt werden.

Da in der Ausgangsdatei keine erlaubten Felder angegeben waren:

- nicht hart validieren,
- Raw-Modus anbieten,
- bestehende Konfiguration unverändert erhalten.

---

### Immich

Erlaubte Felder:

- `users`
- `photos`
- `videos`
- `storage`

---

### JDownloader

Erlaubte Felder:

- `downloadCount`
- `downloadTotalBytes`
- `downloadBytesRemaining`
- `downloadSpeed`

---

### Jellyfin

Erlaubte Felder:

- `movies`
- `series`
- `episodes`
- `songs`

Wichtige Optionen:

- `url`
- `key`
- `version`
- `enableBlocks`
- `enableNowPlaying`
- `enableUser`
- `enableMediaControl`
- `showEpisodeNumber`
- `expandOneStreamToTwoRows`

Hinweise:

- API-Key wird im Jellyfin-Adminbereich unter „Advanced > API Keys“ erstellt.
- Für Jellyfin-Versionen ab 10.12 soll `version: 2` unterstützt werden.
- Für ältere Versionen bleibt `version: 1` Standard.

Beispiel:

```yaml
widget:
  type: jellyfin
  url: http://jellyfin.host.or.ip:port
  key: "{{HOMEPAGE_VAR_JELLYFIN_KEY}}"
  version: 2
  enableBlocks: true
  enableNowPlaying: true
  enableUser: true
  enableMediaControl: false
  showEpisodeNumber: true
  expandOneStreamToTwoRows: false
```

---

### Linkwarden

Erlaubte Felder:

- `links`
- `collections`
- `tags`

---

### Minecraft

Erlaubte Felder:

- `players`
- `version`
- `status`

---

### Nextcloud

Erlaubte Felder:

- `cpuload`
- `memoryusage`
- `freespace`
- `activeusers`
- `numfiles`
- `numshares`

Hinweise:

- `cpuload` und `memoryusage` sind deprecated.
- Maximal 4 Felder anzeigen.
- Authentifizierung entweder per `key` bzw. NC-Token oder per `username` + `password`.
- Wenn `key` vorhanden ist, soll dieser bevorzugt werden.

Beispiele:

```yaml
widget:
  type: nextcloud
  url: https://nextcloud.host.or.ip:port
  key: "{{HOMEPAGE_VAR_NEXTCLOUD_TOKEN}}"
```

```yaml
widget:
  type: nextcloud
  url: https://nextcloud.host.or.ip:port
  username: username
  password: "{{HOMEPAGE_VAR_NEXTCLOUD_PASSWORD}}"
```

---

### NGINX Proxy Manager

Erlaubte Felder:

- `enabled`
- `disabled`
- `total`

---

### Paperless-ngx

Erlaubte Felder:

- `total`
- `inbox`

---

### Prometheus

Erlaubte Felder:

- `targets_up`
- `targets_down`
- `targets_total`

---

### Prometheus Metric

Der Widget-Typ soll als bekannter Typ geführt werden.

Da in der Ausgangsdatei keine erlaubten Felder angegeben waren:

- nicht hart validieren,
- Raw-Modus anbieten,
- bestehende Konfiguration unverändert erhalten.

---

### Proxmox

Erlaubte Felder:

- `vms`
- `lxc`
- `resources.cpu`
- `resources.mem`

Wichtige Optionen:

- `url`
- `username`
- `password`
- `node`

Hinweise:

- API-Token-Benutzername hat typischerweise das Format `username@pam!TokenID`.
- Das Secret des Tokens wird als Passwort verwendet.
- Optional kann `node` gesetzt werden, um nur einen Node statt den Cluster-Durchschnitt anzuzeigen.

---

### Proxmox Backup Server

Erlaubte Felder:

- `datastore_usage`
- `failed_tasks_24h`
- `cpu_usage`
- `memory_usage`

---

### Pterodactyl

Erlaubte Felder:

- `nodes`
- `servers`

---

### RomM

Maximal 4 Felder.

Erlaubte Felder:

- `platforms`
- `totalRoms`
- `saves`
- `states`
- `screenshots`
- `totalfilesize`

---

### Tailscale

Erlaubte Felder:

- `address`
- `last_seen`
- `expires`
- `user`
- `hostname`
- `name`
- `client_version`
- `os`
- `created`
- `authorized`
- `is_external`
- `update_available`
- `tags`

Wichtige Optionen:

- `key`
- `deviceid`

Hinweise:

- API-Access-Token wird im Tailscale-Dashboard erzeugt.
- Device-ID findet man in den Machine Details.
- Die ID endet typischerweise mit `CNTRL`.

---

### TDarr

Erlaubte Felder:

- `queue`
- `processed`
- `errored`
- `saved`

---

### Traefik

Erlaubte Felder:

- `routers`
- `services`
- `middleware`

---

### Transmission

Erlaubte Felder:

- `leech`
- `download`
- `seed`
- `upload`

---

### Trilium

Erlaubte Felder:

- `version`
- `notesCount`
- `dbSize`

---

### Uptime Kuma

Erlaubte Felder:

- `up`
- `down`
- `uptime`
- `incident`

Wichtige Optionen:

- `url`
- `slug`

Hinweise:

- Uptime Kuma hat keine vollständige API für dieses Widget.
- Das Widget nutzt eine Status Page.
- Aus `http://uptimekuma.host/status/statuspageslug` wird `slug: statuspageslug`.

---

### UptimeRobot

Zwei Modi berücksichtigen.

#### Monitor-spezifischer API-Key

Erlaubte Felder:

- `status`
- `uptime`
- `lastDown`
- `downDuration`

#### Read-only API-Key für alle Monitore

Erlaubte Felder:

- `sitesUp`
- `sitesDown`

Beispiel:

```yaml
widget:
  type: uptimerobot
  url: https://api.uptimerobot.com
  key: "{{HOMEPAGE_VAR_UPTIMEROBOT_KEY}}"
```

---

### Vikunja

Erlaubte Felder:

- `projects`
- `tasks7d`
- `tasksOverdue`
- `tasksInProgress`

Wichtige Optionen:

- `url`
- `key`
- `enableTaskList`
- `version`

Hinweise:

- Aufgabenliste der nächsten 5 Aufgaben ist standardmäßig deaktiviert.
- Ab Vikunja `v1.0.0-rc4` soll `version: 2` unterstützt werden.
- Ältere Versionen nutzen Standard `version: 1`.

Beispiel:

```yaml
widget:
  type: vikunja
  url: http://vikunja.host.or.ip:port
  key: "{{HOMEPAGE_VAR_VIKUNJA_KEY}}"
  enableTaskList: true
  version: 2
```

---

## Info-Widgets für widgets.yaml

Diese Widgets gehören nicht in `services.yaml`, sondern in `widgets.yaml`.

### datetime

Beispiel:

```yaml
- datetime:
    text_size: xl
    format:
      timeStyle: short
```

Optionen:

- `text_size`: `4xl`, `3xl`, `2xl`, `xl`, `md`, `sm`, `xs`
- `locale`
- `format`

Beispiele:

```yaml
format:
  timeStyle: short
  hourCycle: h23
```

```yaml
format:
  dateStyle: short
  timeStyle: short
  hour12: true
```

---

### greeting

```yaml
- greeting:
    text_size: xl
    text: Greeting Text
```

Optionen:

- `text_size`
- `text`

---

### logo

```yaml
- logo:
    icon: https://example.com/logo.png
```

Optionen:

- `icon`

---

### openmeteo

```yaml
- openmeteo:
    label: Duisburg
    latitude: 51.4344
    longitude: 6.7623
    timezone: Europe/Berlin
    units: metric
    cache: 5
    format:
      maximumFractionDigits: 1
```

Optionen:

- `label`
- `latitude`
- `longitude`
- `timezone`
- `units`
- `cache`
- `format`

Hinweis:

- Ohne Latitude/Longitude kann die Standortfunktion des Browsers genutzt werden, braucht aber einen sicheren Kontext wie HTTPS.

---

### resources

```yaml
- resources:
    cpu: true
    memory: true
    disk: /mnt/storage
    cputemp: true
    uptime: true
    refresh: 3000
    diskUnits: bytes
    network: true
```

Optionen:

- `label`
- `cpu`
- `memory`
- `disk`
- `cputemp`
- `tempmin`
- `tempmax`
- `uptime`
- `units`
- `refresh`
- `diskUnits`
- `network`
- `expanded`

Mehrere Disks:

```yaml
- resources:
    label: Storage
    disk:
      - /mnt/storage
      - /mnt/backup
      - /mnt/media
```

Hinweis:

- Docker-Container müssen die entsprechenden Mounts sehen können.
- Für Host-Netzwerkschnittstellen kann `/sys:/sys:ro` nötig sein.

---

### search

```yaml
- search:
    provider: google
    focus: true
    showSearchSuggestions: true
    target: _blank
```

Unterstützte Provider:

- `google`
- `duckduckgo`
- `bing`
- `baidu`
- `brave`
- `custom`

Mehrere Provider:

```yaml
- search:
    provider:
      - brave
      - google
      - duckduckgo
```

Custom Provider:

```yaml
- search:
    provider: custom
    url: https://www.ecosia.org/search?q=
    target: _blank
    suggestionUrl: https://ac.ecosia.org/autocomplete?type=list&q=
    showSearchSuggestions: true
```

---

## UI-Anforderungen

Bitte eine verständliche UI für Widgets bauen oder verbessern.

### Für Service-Widgets

Die Service-Bearbeitung soll mindestens enthalten:

- Widget aktivieren/deaktivieren
- Widget-Typ auswählen
- URL-Feld
- Auth-Felder je nach Typ
- Felderauswahl `fields`
- Validierung pro Widget-Typ
- Hinweis bei maximaler Feldanzahl
- Raw-Modus für komplexe oder unbekannte Widgets

### Für Info-Widgets

Die Info-Widget-Bearbeitung soll mindestens enthalten:

- Reihenfolge ändern
- Widget hinzufügen
- Widget löschen
- Widget-Typ auswählen
- einfache Optionen über Formular
- komplexe Optionen über Raw-Modus

---

## Validierungsregeln

Bitte folgende Regeln implementieren:

1. `widget.type` ist Pflicht, sobald ein Widget existiert.
2. `fields` darf nur erlaubte Werte enthalten, wenn für den Widget-Typ eine Liste bekannt ist.
3. Wenn `maxFields` gesetzt ist, darf die Anzahl der Felder diesen Wert nicht überschreiten.
4. Secrets werden nicht versehentlich überschrieben.
5. Leere optionale Felder werden nicht als leere Strings gespeichert, außer das Projekt macht das bereits bewusst so.
6. Zahlen und Booleans bleiben typgetreu erhalten.
7. Unbekannte Widget-Typen bleiben erhalten und werden nicht automatisch gelöscht.
8. Raw-YAML muss vor dem Speichern validiert werden.
9. Bei Fehlern klare Meldungen anzeigen, z. B.:
   - „Dieses Feld wird vom Widget-Typ nicht unterstützt.“
   - „Dieses Widget erlaubt maximal 4 Felder.“
   - „YAML ist ungültig.“
   - „Secret bleibt unverändert, da kein neuer Wert eingegeben wurde.“

---

## Erwartete Dateien / mögliche Stellen im Projekt

Bitte im Projekt suchen, aber wahrscheinlich relevant sind Dateien wie:

- YAML-Parser und YAML-Schreiblogik
- Config-Editor
- Services-Editor
- Widgets-Editor
- API-Routen für Konfiguration
- Tests für YAML-Editierung
- UI-Komponenten für Formulare

Nicht blind neue Architektur bauen, wenn es schon passende Stellen gibt. Bestehende Muster im Projekt verwenden.

---

## Testanforderungen

Bitte Tests ergänzen oder anpassen.

### Unit-Tests

Mindestens testen:

- Jellyfin-Widget mit Secret bleibt beim Speichern erhalten.
- Dockhand erlaubt maximal 4 Felder.
- Karakeep erlaubt maximal 4 Felder.
- Fritz!Box erlaubt maximal 4 Felder.
- Nextcloud erlaubt maximal 4 Felder.
- Unbekannter Widget-Typ bleibt erhalten.
- `[redacted]` wird nie in YAML geschrieben.
- Leeres Secret überschreibt vorhandenes Secret nicht.
- Boolean-Optionen bleiben Boolean.
- Zahlenoptionen bleiben Number.
- `fields` mit ungültigem Wert wird abgelehnt.
- Raw-YAML mit Syntaxfehler wird abgelehnt.

### Integrationstests

Mindestens testen:

- Service mit vorhandenem Widget bearbeiten.
- Service ohne Widget bekommt neues Widget.
- Widget löschen entfernt nur `widget`, nicht den Service.
- Info-Widget in `widgets.yaml` hinzufügen.
- Info-Widget löschen.
- Reihenfolge der Info-Widgets ändern.

---

## Akzeptanzkriterien

Die Aufgabe gilt als erledigt, wenn:

- bekannte Widgets über UI oder API sauber bearbeitet werden können,
- erlaubte Felder pro Widget validiert werden,
- Maximalwerte eingehalten werden,
- Secrets sicher behandelt werden,
- unbekannte Widgets erhalten bleiben,
- `services.yaml` und `widgets.yaml` nach Bearbeitung gültiges YAML bleiben,
- bestehende Services nicht beschädigt werden,
- Tests grün sind,
- Lint grün ist,
- Änderungen kurz dokumentiert sind.

---

## Nicht-Ziele

Bitte nicht umsetzen, außer es ist bereits im Projekt vorgesehen:

- keine Live-Abfrage der Widget-APIs aus der UI,
- kein Speichern echter Secrets im Frontend-State über das notwendige Maß hinaus,
- kein komplettes Redesign der Anwendung,
- keine Migration aller bestehenden YAML-Dateien in ein neues Format,
- keine harte Entfernung unbekannter oder veralteter Widget-Konfigurationen.

---

## Empfohlener Arbeitsablauf für Codex

1. Projektstruktur analysieren.
2. Bestehende YAML-Editierlogik finden.
3. Bestehende Widget-/Service-UI finden.
4. Kleine zentrale Widget-Schema-Registry erstellen.
5. Validatoren schreiben.
6. YAML-Schreiblogik erweitern.
7. UI an Schema anbinden.
8. Raw-Modus absichern.
9. Tests ergänzen.
10. Lint und Tests ausführen.
11. Kurze Zusammenfassung der Änderungen ausgeben.

---

## Kurzer Prompt, falls Codex direkt gestartet wird

Bitte implementiere auf Basis dieser Datei eine sichere Widget-Verwaltung für Homepage-Kito. Nutze eine zentrale Widget-Schema-Registry, validiere erlaubte Felder und Maximalwerte, behandle Secrets sicher, erhalte unbekannte Widgets, unterstütze Raw-YAML für komplexe Fälle und ergänze Unit- sowie Integrationstests. Verändere bestehende YAML-Strukturen nur minimal und stelle sicher, dass `services.yaml` und `widgets.yaml` nach dem Speichern gültig bleiben.
