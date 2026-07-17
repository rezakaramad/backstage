# [Backstage](https://backstage.io)

This is a customized Backstage, built on [Backstage](https://backstage.io)
using the [new frontend & backend system](https://backstage.io/docs/frontend-system/).

---

## Table of contents

- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [Configuration files](#configuration-files)
- [Enabling / disabling plugins](#enabling--disabling-plugins)
- [Authentication](#authentication)
- [The software catalog](#the-software-catalog)
- [Deployment](#deployment)
- [Common tasks](#common-tasks)

---

## Repository layout

```
backstage/
├── app-config.yaml              # Base config — used for LOCAL development (guest auth, in-memory DB)
├── app-config.production.yaml   # Production overrides — real DB, oauth2-proxy auth, msgraph sync
├── catalog/
│   └── org.yaml                 # Static catalog entities (users/groups now come from Entra sync)
├── examples/                    # Sample entities & a demo scaffolder template
├── packages/
│   ├── app/                     # FRONTEND (React) — everything the user sees in the browser
│   │   └── src/
│   │       ├── App.tsx          # App entry: registers frontend plugins + sign-in page
│   │       ├── index.tsx        # ReactDOM bootstrap (rarely touched)
│   │       └── modules/
│   │           └── nav/         # Custom sidebar / navigation
│   │               ├── Sidebar.tsx   # The left nav bar (menu items, People, Log out)
│   │               └── SidebarLogo.tsx
│   └── backend/                 # BACKEND (Node.js) — APIs, catalog, auth, search, etc.
│       ├── src/index.ts         # Backend entry: registers all backend plugins
│       └── Dockerfile           # Image built & pushed to ghcr.io/rezakaramad/backstage
└── package.json                 # Yarn 4 workspaces root
```

**Rule of thumb:**

| Want to change… | Edit… |
|---|---|
| Something visual (UI, sidebar, pages) | `packages/app/src/` |
| An API, catalog behaviour, auth, search | `packages/backend/src/index.ts` |
| Runtime config (URLs, DB, auth providers) | `app-config*.yaml` |
| Which users/groups exist | Nothing — synced from Entra ID |

---

## Local development

Backstage uses **Yarn 4** (pinned via `packageManager` in `package.json`). Use the
project-local yarn release so you always get the right version:

```fish
# From the backstage/ directory
set -x YARN node .yarn/releases/yarn-4.13.0.cjs

# Install dependencies (first time / after pulling)
$YARN install

# Start frontend (:3000) + backend (:7007) with hot reload
$YARN dev
```

Locally, `app-config.yaml` is used: auth is **guest** (no login), and the database
is **in-memory SQLite** — nothing persists between restarts. This is intentional so
you can iterate without a cluster.

Other useful commands:

```fish
$YARN tsc          # Type-check the whole workspace (run before pushing)
$YARN lint:all     # Lint
$YARN test         # Unit tests
```

---

## Configuration files

Backstage merges config files in order; later files override earlier ones.

- **`app-config.yaml`** — the base. Loaded in every environment. Local dev uses
  *only* this file, so it contains dev-friendly defaults (guest auth, SQLite).
- **`app-config.production.yaml`** — layered on top in the cluster. Contains the
  real PostgreSQL connection, the `oauth2Proxy` auth provider, and the
  `microsoftGraphOrg` catalog sync. Values like `${APP_BASE_URL}` are injected as
  environment variables by the Helm chart.

Anything under `${...}` is an environment variable resolved at runtime (see the
chart's `extraEnvVars` / `extraEnvVarsSecrets` in
`kubepave/charts/backstage/values*.yaml`).

---

## Enabling / disabling plugins

The new system registers plugins explicitly. There are two sides.

### Backend plugins — `packages/backend/src/index.ts`

Each plugin is one `backend.add(...)` line. To **disable** a plugin, comment out or
delete its line. To **enable** a new one, install the package and add a line.

```ts
// Example: the catalog + its MSGraph (Entra ID) sync module
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('@backstage/plugin-catalog-backend-module-msgraph'));
```

Install a new backend plugin:

```fish
$YARN workspace backend add @backstage/plugin-<name>
# then add a backend.add(import('@backstage/plugin-<name>')) line in index.ts
```

### Frontend plugins — `packages/app/src/App.tsx`

Frontend plugins are listed in the `features` array of `createApp(...)`. Note many
new-system plugins are imported from their **`/alpha`** entry point.

```ts
export default createApp({
  features: [catalogPlugin, orgPlugin, navModule, signInModule],
});
```

Install a new frontend plugin:

```fish
$YARN workspace app add @backstage/plugin-<name>
# then import it (often from '@backstage/plugin-<name>/alpha') and add it to `features`
```

> Tip: if an import errors with a type mismatch on `features`, you probably need the
> `/alpha` entry point of that plugin for the new frontend system.

### Custom navigation

The sidebar is a custom module in `packages/app/src/modules/nav/Sidebar.tsx`. Menu
items for pages are pulled in with `nav.take('page:<id>')`; custom items (like
**People** and **Log out**) are added as plain `<SidebarItem>`s.

---

## Authentication

Auth is handled **outside** Backstage by
[oauth2-proxy](https://github.com/oauth2-proxy/oauth2-proxy), which sits in front of
the pod and does the full Microsoft (Entra ID) OIDC flow:

```
Browser → Traefik → oauth2-proxy (:4180) → Backstage (:7007)
```

- **Frontend** (`App.tsx`) uses `ProxiedSignInPage` in production — it silently picks
  up the session the proxy already established (no login screen). In local dev it
  falls back to guest.
- **Backend** (`index.ts`) uses
  `@backstage/plugin-auth-backend-module-oauth2-proxy-provider`, which reads the
  user identity from headers the proxy injects (`X-Forwarded-Email`).
- **Sign-out** (`Sidebar.tsx`) redirects through `/oauth2/sign_out` to Microsoft's
  logout endpoint for a full SSO logout.

The proxy, its secrets, and the NetworkPolicy that forces all traffic through it live
in the Helm chart at `kubepave/charts/backstage/`.

---

## The software catalog

Users and groups are **synced automatically from Entra ID** every 30 minutes via the
`microsoftGraphOrg` provider (configured in `app-config.production.yaml`). You should
**not** add users to `catalog/org.yaml` by hand.

Login resolves the Entra email against the synced `User` entity
(`emailMatchingUserEntityProfileEmail`).

Verify a sync ran:

```fish
kubectl --context kind-management -n backstage logs deployment/backstage \
  --tail=100 | grep -i 'msgraph\|ingested\|committed'
```

To register a **software component**, add a `catalog-info.yaml` to that repo and
register it as a `Location` (via the Catalog → "Register existing component" UI or a
`catalog.locations` entry in config).

---

## Deployment

1. Merge to `main` → CI builds `packages/backend/Dockerfile` and pushes
   `ghcr.io/rezakaramad/backstage:<tag>`.
2. ArgoCD (app defined in `kubepave/argocd-applications/local/management/backstage.yaml`)
   deploys the chart at `kubepave/charts/backstage/`.
3. Infra concerns (oauth2-proxy, ExternalSecrets, HTTPRoute, DB) are all in that chart —
   not in this repo.

---

## Common tasks

| Task | How |
|---|---|
| Run locally | `$YARN dev` (guest auth, no cluster needed) |
| Add a backend plugin | `$YARN workspace backend add …` + `backend.add(...)` in `index.ts` |
| Add a frontend plugin | `$YARN workspace app add …` + add to `features` in `App.tsx` |
| Disable a plugin | Comment out its `backend.add(...)` / `features` entry |
| Change the sidebar | Edit `packages/app/src/modules/nav/Sidebar.tsx` |
| Change prod config | Edit `app-config.production.yaml` (env vars come from the chart) |
| Onboard a user | Nothing — they appear after the next Entra sync |
| Type-check before pushing | `$YARN tsc` |
