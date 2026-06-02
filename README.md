# homepage-Kito

`homepage-Kito` is a self-hosted dashboard for services, bookmarks and widgets. It is based on
[`gethomepage/homepage`](https://github.com/gethomepage/homepage), but is developed as an independent
project with a growing admin/config UI while keeping YAML as the source of truth.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/banner_light@2x.png">
    <img src="images/banner_dark@2x.png" width="65%" alt="homepage-Kito banner">
  </picture>
</p>

<p align="center">
  <img src="images/1.png" alt="homepage-Kito dashboard screenshot" />
</p>

## What makes this project different

- Hybrid admin UI for `services.yaml`, `bookmarks.yaml`, `widgets.yaml` and `settings.yaml`
- Layout and tab management under `/admin/layout`
- Theme and branding management under `/admin/theme`
- Auth, roles and user management (`admin` / `viewer`)
- Config health checks, widget configuration, info widgets and icon suggestions
- YAML remains the source of truth; UI changes land in the editor first and are saved explicitly

## Origin and scope

This project started from `gethomepage/homepage` and therefore continues to follow the GPLv3 license
requirements of that codebase. `homepage-Kito` is not maintained as an upstream-facing fork; it is
developed independently for a YAML-first dashboard with a stronger built-in admin experience.

## Quick start

### Docker deployment

Recommended path: build on your PC, push to Docker Hub, let the server only pull the finished image.
See [DOCKER.md](DOCKER.md) for the full workflow.

Server-side quick start:

```bash
cp .env.example .env
docker compose pull
docker compose up -d
```

First startup:

1. Open `http://<server>:3000`
2. Complete `/setup`
3. Create the first admin account
4. Continue through `/login`

Important environment variables:

- `HOMEPAGE_SESSION_SECRET`: required, at least 32 characters
- `HOMEPAGE_ALLOWED_HOSTS`: set this once you access the app via IP or domain
- `HOMEPAGE_SECURE_COOKIE`: keep `false` on plain HTTP, set `true` only behind HTTPS
- `DOCKERHUB_IMAGE`: image tag used by the server-side pull workflow

### Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
pnpm build
pnpm start
pnpm lint
pnpm test
```

## Configuration model

Configuration continues to live in YAML files inside the config directory:

- `services.yaml`
- `bookmarks.yaml`
- `widgets.yaml`
- `settings.yaml`
- `docker.yaml`
- `users.yaml`

The admin UI reads and edits those files through safe server-side helpers. Validation, backup creation
and manual save are kept explicit so the raw YAML remains inspectable and recoverable.

## Project status

Implemented areas already include:

- structured config editing
- drag and drop / reordering helpers
- layout and tab management
- authentication and roles
- theming and branding UI
- config health checks
- service widget configuration
- info widget management
- icon and favicon suggestions

For the detailed roadmap and milestone status, see [CLAUDE.md](CLAUDE.md).

## Contributing and support

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the current contribution rules and
project expectations.

If you are working mainly on the dashboard configuration and admin UI, also review the project notes in
`CLAUDE.md` / `AGENTS.md` before making broader architectural changes.

## Upstream docs

The original Homepage documentation is still useful for many YAML concepts, widgets and integrations:
[gethomepage.dev](https://gethomepage.dev/).

Treat it as reference material for the underlying dashboard model, while `homepage-Kito` adds its own
admin/config workflow on top.

## License

This repository is licensed under **GPL-3.0-only**. It is based on code from
[`gethomepage/homepage`](https://github.com/gethomepage/homepage), so the GPLv3 obligations continue to
apply. Keep copyright and license notices intact when redistributing modified versions.
