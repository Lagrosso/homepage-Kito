# homepage-Kito mit Docker betreiben

Empfohlener Weg: **auf dem PC bauen → zu Docker Hub pushen → der Server zieht nur das fertige Image.**
Der Server baut nichts, braucht keinen Quellcode und kein GitHub-Deploy.

---

## A) Einmalig auf dem PC (Build-Maschine)

1. **Docker-Hub-Account** anlegen (falls noch nicht vorhanden) und ein **öffentliches** Repository
   `homepage-kito` erstellen (auf hub.docker.com → „Create repository").
2. Auf dem PC einmal anmelden:
   ```bash
   docker login
   ```
3. Im Projektordner eine `.env` anlegen und deinen Docker-Hub-Namen eintragen:
   ```bash
   cp .env.example .env
   # in .env: DOCKERHUB_IMAGE=deinuser/homepage-kito:latest
   ```

## B) Image bauen & hochladen (PC – bei jedem Update)

```bash
./scripts/docker-build-push.sh
```

Das baut das Image und pusht es nach `deinuser/homepage-kito:latest`.
(Alternativ direkt: `docker build -t deinuser/homepage-kito:latest . && docker push deinuser/homepage-kito:latest`.)

## C) Auf dem Server (einmalig einrichten)

Du brauchst dort **nur zwei Dateien**: `docker-compose.yml` und `.env`.

1. `docker-compose.yml` aus diesem Repo auf den Server kopieren.
2. `.env` daneben anlegen:
   ```ini
   # 32+ Zeichen Secret – einmal erzeugen mit: openssl rand -hex 32
   HOMEPAGE_SESSION_SECRET=dein-langes-zufalls-secret

   # Adresse(n), unter denen du das Dashboard aufrufst (sonst „Host validation failed"):
   HOMEPAGE_ALLOWED_HOSTS=192.168.x.y:3000

   # Dasselbe Image wie auf dem PC:
   DOCKERHUB_IMAGE=deinuser/homepage-kito:latest
   ```
3. Starten:
   ```bash
   docker compose pull
   docker compose up -d
   ```
4. Im Browser `http://<server>:3000` öffnen → du landest auf **`/setup`** → ersten **Admin** anlegen.
   Danach läuft alles über `/login`.

## D) Updaten

Auf dem PC neu bauen/pushen (Schritt B), dann auf dem Server:
```bash
docker compose pull && docker compose up -d
```

---

## Wichtige Hinweise

- **`HOMEPAGE_SESSION_SECRET` ist Pflicht** (seit der Auth-Einführung). Ohne gültiges Secret (≥ 32 Zeichen)
  startet die App nicht. Erzeugen: `openssl rand -hex 32`.
- **`HOMEPAGE_ALLOWED_HOSTS`**: Standardmäßig sind nur `localhost:3000` / `127.0.0.1` erlaubt. Für den
  Zugriff über IP oder Domain die echte(n) Adresse(n) (kommagetrennt) eintragen, z. B.
  `homepage.local:3000,192.168.14.10:3000` — oder `*` zum Deaktivieren der Prüfung.
- **`HOMEPAGE_SECURE_COOKIE`** (Default `false`): Nur auf `true` setzen, wenn du das Dashboard über
  **HTTPS** aufrufst. Über `http://` (LAN/IP) muss es `false` bleiben — sonst markiert der Server das
  Login-Cookie als `Secure`, der Browser verwirft es über HTTP, und du kannst dich nach dem Setup
  **nicht anmelden** (häufigste Stolperfalle).
- **Konfiguration & Backups** liegen im Volume `./config` (services.yaml, bookmarks.yaml, widgets.yaml,
  settings.yaml, `users.yaml`, `.backups/`, hochgeladene Hintergründe). **Im Image stecken keine Secrets** –
  daher ist ein öffentliches Docker-Hub-Repo unproblematisch.
- **SELinux (Fedora/RHEL/CentOS-Server):** falls der Container das Config-Volume nicht schreiben kann
  (`EACCES`), in der `docker-compose.yml` das Volume auf `./config:/app/config:z` ändern.
- **Als bestimmter Benutzer laufen:** optional `PUID`/`PGID` in der `docker-compose.yml` setzen, damit die
  Dateien im `config`-Ordner deinem Benutzer gehören.
- **Docker-Integrationen** (Container-Status etc.): optional den Docker-Socket read-only einhängen
  (`/var/run/docker.sock:/var/run/docker.sock:ro`).
- **Privat statt öffentlich** möglich: dann auch auf dem Server einmal `docker login` ausführen.
- **Healthcheck:** Der Container meldet sich über `GET /api/healthcheck` als „healthy" (in `docker ps`
  sichtbar).
