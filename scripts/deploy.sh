#!/usr/bin/env bash
set -euo pipefail

require() {
  if [[ -z "${!1:-}" ]]; then
    printf '%s is required\n' "$1" >&2
    exit 1
  fi
}

require SSH_USERNAME
require SSH_PROJECT_DIRECTORY
require DEPLOY_SHA
SSH_HOST="${SSH_HOST:-${SSH_IP:-}}"
require SSH_HOST
SSH_PORT="${SSH_PORT:-22}"
APP_PORT="${APP_PORT:-${PORT:-}}"

if [[ ! "$DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "DEPLOY_SHA must be a full commit SHA" >&2
  exit 1
fi
if [[ "$SSH_PROJECT_DIRECTORY" != /* ]]; then
  echo "SSH_PROJECT_DIRECTORY must be an absolute path" >&2
  exit 1
fi
if [[ ! "$SSH_USERNAME" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$ ]] || [[ "$SSH_HOST" == -* || "$SSH_HOST" =~ [[:space:]] ]]; then
  echo "Invalid SSH username or host" >&2
  exit 1
fi
valid_port() {
  [[ "$1" =~ ^[0-9]{1,5}$ ]] && (( 10#$1 > 0 && 10#$1 <= 65535 ))
}
if ! valid_port "$SSH_PORT"; then
  echo "SSH_PORT must be between 1 and 65535" >&2
  exit 1
fi
if [[ -n "$APP_PORT" ]] && ! valid_port "$APP_PORT"; then
  echo "APP_PORT must be between 1 and 65535" >&2
  exit 1
fi
if [[ -z "${SSH_PRIVATE_KEY:-}" && -z "${SSH_PRIVATE_KEY_FILE:-}" ]]; then
  echo "SSH_PRIVATE_KEY or SSH_PRIVATE_KEY_FILE is required" >&2
  exit 1
fi
if [[ -z "${SSH_KNOWN_HOSTS:-}" && -z "${SSH_KNOWN_HOSTS_FILE:-}" ]]; then
  echo "SSH_KNOWN_HOSTS or SSH_KNOWN_HOSTS_FILE is required" >&2
  exit 1
fi

umask 077
deploy_tmp="$(mktemp -d)"
trap 'rm -rf -- "$deploy_tmp"' EXIT
if [[ -n "${SSH_PRIVATE_KEY:-}" ]]; then
  printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > "$deploy_tmp/id"
else
  tr -d '\r' < "$SSH_PRIVATE_KEY_FILE" > "$deploy_tmp/id"
fi
if [[ -n "${SSH_KNOWN_HOSTS:-}" ]]; then
  printf '%s\n' "$SSH_KNOWN_HOSTS" | tr -d '\r' > "$deploy_tmp/known_hosts"
else
  tr -d '\r' < "$SSH_KNOWN_HOSTS_FILE" > "$deploy_tmp/known_hosts"
fi
if [[ ! -s "$deploy_tmp/id" || ! -s "$deploy_tmp/known_hosts" ]]; then
  echo "SSH key and known_hosts must not be empty" >&2
  exit 1
fi

# SSH sends one command through the remote login shell. Quote its arguments
# for POSIX shells, including directory names containing spaces or apostrophes.
quote() {
  printf "'"
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
  printf "'"
}
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
remote_command="sh -s -- $(quote "$SSH_PROJECT_DIRECTORY") $(quote "$DEPLOY_SHA") $(quote "$APP_PORT")"
ssh \
  -i "$deploy_tmp/id" \
  -p "$SSH_PORT" \
  -o IdentitiesOnly=yes \
  -o UserKnownHostsFile="$deploy_tmp/known_hosts" \
  -o GlobalKnownHostsFile=/dev/null \
  -o StrictHostKeyChecking=yes \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -- "${SSH_USERNAME}@${SSH_HOST}" "$remote_command" < "$script_dir/deploy-remote.sh"
