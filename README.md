# Buscabolets

A Catalan woodland puzzle game built with Next.js 16, React 19 and TypeScript. Explore a 10×10 grid, collect every mushroom before the turns run out, and choose a talent between levels. The interface works on desktop and mobile, supports keyboard play, and installs as a PWA.

## Run locally

Use Node.js 24 and pnpm 11.25.0, or Docker with Compose 2.23 or newer.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>.

For development in Docker, with automatic source syncing and hot reload:

```sh
docker compose up --build --watch
```

The development port is bound to the local machine. To use a different port:

```sh
DEV_PORT=3001 docker compose up --build --watch
```

Dependencies and lockfile changes rebuild the development image. Source and public assets sync into the container. Stop with Ctrl+C, then `docker compose down` to remove the container. This uses [Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/).

## Production on a VPS

Production runs one non-root Next.js container. `APP_PORT` controls the host port, defaulting to 3001. `APP_BIND_ADDRESS` controls the interface, defaulting to 127.0.0.1. Configure your existing reverse proxy to forward to that address and port. HTTPS is handled outside this repository.

The VPS needs Git, Docker Engine and the Docker Compose plugin. Clone the private repository into a dedicated deployment checkout and create its environment file:

```sh
ssh your-user@your-vps
mkdir -p ~/apps
cd ~/apps
git clone git@github.com:rogerclotet/buscabolets.git
cd buscabolets
cp .env.production.example .env.production
nano .env.production
```

Set `APP_PORT` to a free port on the VPS. Change `APP_BIND_ADDRESS` if the reverse proxy needs a different interface. Keep machine-specific settings in `.env.production`; automated deployment refuses to overwrite tracked edits in this checkout.

The VPS must be able to fetch the private GitHub repository without a password prompt. Use a separate read-only GitHub deploy key on the VPS, and verify this from the checkout:

```sh
git fetch origin main
```

Manual startup and inspection:

```sh
docker compose --env-file .env.production -f compose.production.yml up -d --build --wait --wait-timeout 180
docker compose --env-file .env.production -f compose.production.yml ps
docker compose --env-file .env.production -f compose.production.yml logs --tail=100 app
```

To stop the application:

```sh
docker compose --env-file .env.production -f compose.production.yml down
```

There is no database or server-side player account. All gameplay and statistics live in each browser. Production environment files are excluded from git and Docker image builds.

## Automatic deployment on merge

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) follows [Pronosticat's deployment workflow](https://github.com/rogerclotet/pronosticat/blob/main/.github/workflows/ci.yml). Every pull request runs lint, type checks, engine and deployment tests, a production build, desktop/mobile browser tests and development hydration tests. Every push to `main`, including a merged PR, deploys only after those checks pass. Manual runs from the Actions tab also deploy when the selected branch is `main`.

The deploy job sends [`scripts/deploy-remote.sh`](scripts/deploy-remote.sh) over SSH through [`scripts/deploy.sh`](scripts/deploy.sh). It fetches `main` and checks out the exact SHA that CI tested. If another commit has reached `main` in the meantime, the older deployment is skipped. GitHub deploy jobs run one at a time, with in-progress deployments allowed to finish.

The image builds before the running container is replaced. Compose then waits up to 180 seconds for health; a failed build or unhealthy app fails the workflow. No automatic rollback is performed after a container health failure. The script does not prune shared Docker images or volumes.

### One-time GitHub configuration

Configure these in [Buscabolets → Settings → Secrets and variables → Actions](https://github.com/rogerclotet/buscabolets/settings/secrets/actions). The SSH secret names match Pronosticat. Repository secrets are not shared automatically, and GitHub cannot return their existing values for copying.

| Secret                  | Value                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| `SSH_PRIVATE_KEY`       | Private deployment key whose public key is authorized on the VPS. |
| `SSH_KNOWN_HOSTS`       | Verified SSH host-key entry for the VPS.                          |
| `SSH_USERNAME`          | VPS deployment user, with access to Docker and the checkout.      |
| `SSH_HOST`              | VPS hostname or IP. Existing `SSH_IP` naming is also supported.   |
| `SSH_PROJECT_DIRECTORY` | Absolute path to the **Buscabolets** checkout on the VPS.         |
| `SSH_PORT`              | Optional SSH port; defaults to 22.                                |

Optional repository **variable** `APP_PORT` overrides the port from the VPS `.env.production`. The existing Pronosticat-style **secret** `PORT` is also supported. Port precedence is `APP_PORT` variable, then `PORT` secret, then the VPS `.env.production`, then 3001.

To create a dedicated GitHub-to-VPS key:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/github-buscabolets-deploy -N '' -C 'buscabolets-github-deploy'
ssh-copy-id -i ~/.ssh/github-buscabolets-deploy.pub your-user@your-vps
gh secret set SSH_PRIVATE_KEY --repo rogerclotet/buscabolets < ~/.ssh/github-buscabolets-deploy
```

Collect the host key with `ssh-keyscan -p 22 your-vps` and verify its fingerprint against the server before saving it as `SSH_KNOWN_HOSTS`. For a non-default SSH port, scan that port; the entry includes `[host]:port`. Host-key checking remains enabled in the deployment script.

Add the remaining secrets using the GitHub settings page or `gh secret set NAME --repo rogerclotet/buscabolets`. To set a port override:

```sh
gh variable set APP_PORT --repo rogerclotet/buscabolets --body '3001'
```

After the checkout, environment file and secrets are ready, merge to `main` or run **CI and deployment → Run workflow → main**. No server password is needed by the workflow.

For a manual deployment through the same script, use local key files:

```sh
SSH_HOST=your-vps \
SSH_USERNAME=your-user \
SSH_PROJECT_DIRECTORY=/home/your-user/apps/buscabolets \
SSH_PRIVATE_KEY_FILE=/path/to/deploy-key \
SSH_KNOWN_HOSTS_FILE=/path/to/verified-known-hosts \
DEPLOY_SHA=FULL_COMMIT_SHA_FROM_MAIN \
bash scripts/deploy.sh
```

## Game rules

- Every level has a 10×10 board. Level 1 has 8 mushrooms and 32 turns. Level 2 has 31 turns; from level 3 the base budget is 30. Mushroom count rises to 22. Each stamina upgrade adds 2 turns, up to 10 extra turns.
- Picking a tile costs one turn. Connected empty areas open automatically at no additional cost.
- A number counts occupied mushroom tiles in the eight adjacent tiles. Clues stay unchanged after collection. If both halves of a two-tile mushroom are adjacent, they contribute 2 to the clue.
- Rovellons take 1 picking power and award 10 points. Ceps need 3 accumulated power and award 25 points. Revealed ceps that need more taps have a purple tile and a hand badge showing the exact taps remaining for the current picking power. Each tap costs one turn. Rossinyols span two horizontally adjacent tiles, both of which must be picked, and award 30 points for the pair.
- Flags are free. They protect marked tiles from picking and automatic reveals. Use the tool switch, right click, or F. Arrow keys move through the board; Enter or Space picks a tile.
- The starter kit includes 1 picking power, one three-tile rake use, and one free directional hint per level. Press Olfacte boletaire to show a hint from the last picked tile, or E5 before the first pick. Hints prioritize the nearest hidden mushroom part, falling back to unfinished revealed parts when none remain hidden. Each compass upgrade adds one hint per level. Repeating an unchanged hint costs no charge, and using a hint switches back to the explore tool so its message is visible.
- Beating a level offers up to three randomly selected talents that are not yet maxed out. Choose one before entering the next level. Talents improve picking power, rake charges, hint charges, the turn budget, or free empty reveals when collecting.
- Each talent caps at level 5. Once all talents are maxed, the run can continue without another upgrade. Rake and hint charges refill every level.
- Collecting the final mushroom on the final turn wins the level. Otherwise, zero turns ends the run and reveals the remaining mushrooms.
- Starting another excursion resets talents and the basket. Lifetime totals retain mushrooms by species, completed levels, turns used, score, finished excursions and the highest completed level. Lifetime stats provide no gameplay bonuses.

The mushroom drawings are simple colored SVG placeholders. The game species and their behavior are fictional, and this app is not a real-world identification guide.

## Saved progress and offline play

The current run and lifetime statistics are saved together in localStorage after every action under `buscabolets-v1`. Saved data is validated with Zod before use; unreadable saves start a fresh game. If storage is unavailable, the interface explains that progress cannot be retained. Keep a run in one tab to avoid independent tabs overwriting the same save.

The production build generates `public/sw.js` with a versioned list of the exact HTML, scripts, styles, fonts and icons for that release. The first online visit caches the app. After installation completes, the game can reload and play offline. Fonts are bundled locally; no third-party requests are needed during play.

The service worker is registered only in production, on HTTPS or localhost. A new release waits until existing game tabs close before activation, keeping a run's HTML and assets on the same version. Close all game tabs and reopen online to activate a waiting update. The save format is independent of the asset cache.

To test the production PWA locally:

```sh
pnpm build
pnpm start
```

Open <http://localhost:3000> and wait for the service worker to activate. Browser developer tools can simulate offline mode. Install instructions are available in the footer of the game.

## Validation

```sh
pnpm test
pnpm test:deploy
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:hydration
```

Deployment tests use real local Git repositories with substituted SSH transport and Docker commands to check commit selection, shell quoting, prerequisites and failure handling. The engine tests exercise board generation, clues, collections, flood reveal, talents, turn accounting, progression, loss and save validation. Browser tests cover desktop and mobile layouts, a full level and upgrade, run endings, dialogs, persistence and an offline reload. Browser tests launch the production app on port 3100; build first. The hydration suite uses a development server on port 3000, reusing it when one is already running. It checks console warnings on fresh loads, saved-run reloads, and when native button state is restored before React hydrates.

## Source map

- `src/lib/game.ts`: deterministic board generation, pure state transitions, rules and save schemas.
- `src/components/game.tsx`: the interactive Catalan interface, storage and audio.
- `src/components/art.tsx`: SVG forest illustration, mushroom placeholders and icons.
- `src/app/globals.css`: responsive woodland visual theme.
- `scripts/service-worker.js` and `scripts/build-service-worker.mjs`: versioned production offline cache.
- `compose.yml`: local development with Compose Watch.
- `compose.production.yml` and `Dockerfile`: production image and configurable HTTP port.
- `.github/workflows/ci.yml` and `scripts/deploy*.sh`: CI checks and SSH deployment on `main`.
