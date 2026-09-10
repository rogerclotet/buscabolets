#!/bin/sh
set -eu

# Executed on the VPS over stdin by deploy.sh. Arguments are already validated
# by the SSH entry point; environment and repository checks happen here.
project_dir=$1
deploy_sha=$2
app_port=${3:-}
cd "$project_dir"

if [ "$(git rev-parse --show-toplevel)" != "$(pwd -P)" ]; then
  echo "SSH_PROJECT_DIRECTORY must be the root of the deployment checkout" >&2
  exit 1
fi
case "$(git config --get remote.origin.url)" in
  git@github.com:rogerclotet/buscabolets.git|https://github.com/rogerclotet/buscabolets.git|https://github.com/rogerclotet/buscabolets|ssh://git@github.com/rogerclotet/buscabolets.git) ;;
  *) echo "Deployment checkout must belong to rogerclotet/buscabolets" >&2; exit 1 ;;
esac
if [ ! -f .env.production ]; then
  echo "Create .env.production on the VPS before the first deployment" >&2
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Deployment checkout has tracked changes; refusing to overwrite them" >&2
  exit 1
fi

git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
latest_sha=$(git rev-parse refs/remotes/origin/main)
if [ "$deploy_sha" != "$latest_sha" ]; then
  printf 'Skipping superseded deployment %s; main is now %s\n' "$deploy_sha" "$latest_sha"
  exit 0
fi

git checkout -B main "$deploy_sha"
printf 'Deploying %s to %s\n' "$deploy_sha" "$project_dir"
if [ -n "$app_port" ]; then
  APP_PORT=$app_port
  export APP_PORT
fi
compose() {
  docker compose --env-file .env.production -f compose.production.yml "$@"
}
compose config --quiet
# Finish building before replacing the running container.
compose build app
if ! compose up -d --no-build --remove-orphans --wait --wait-timeout 180 app; then
  compose ps >&2 || true
  compose logs --tail=60 app >&2 || true
  exit 1
fi
compose ps
printf 'Deployment of %s is healthy\n' "$deploy_sha"
