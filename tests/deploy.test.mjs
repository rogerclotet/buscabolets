import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const deployScript = resolve("scripts/deploy.sh");
function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "buscabolets-deploy-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const upstream = join(root, "upstream.git");
  const author = join(root, "author");
  const checkout = join(root, "Roger's app $(must-not-run)");
  const bin = join(root, "bin");
  mkdirSync(bin);
  mkdirSync(author);
  git(root, "init", "--bare", "--initial-branch=main", upstream);
  git(author, "init", "--initial-branch=main");
  git(author, "config", "user.email", "deploy-test@example.com");
  git(author, "config", "user.name", "Deployment test");
  writeFileSync(join(author, ".gitignore"), ".env.production\n");
  writeFileSync(join(author, "release.txt"), "first\n");
  git(author, "add", ".");
  git(author, "commit", "-m", "First release");
  git(author, "remote", "add", "origin", upstream);
  git(author, "push", "origin", "main");
  git(root, "clone", upstream, checkout);
  const repository = "https://github.com/rogerclotet/buscabolets.git";
  git(checkout, "remote", "set-url", "origin", repository);
  git(checkout, "config", `url.file://${upstream}.insteadOf`, repository);
  writeFileSync(join(checkout, ".env.production"), "APP_PORT=4567\n");
  const oldSha = git(checkout, "rev-parse", "HEAD");
  writeFileSync(join(author, "release.txt"), "second\n");
  git(author, "commit", "-am", "Second release");
  git(author, "push", "origin", "main");
  const sha = git(author, "rev-parse", "HEAD");

  // Real local Git repositories exercise checkout/fetch and shell quoting.
  // Only the SSH transport and Docker daemon are substituted.
  writeFileSync(
    join(bin, "ssh"),
    `#!${process.execPath}
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const args = process.argv.slice(2);
const key = args[args.indexOf('-i') + 1];
const hosts = args.find(a => a.startsWith('UserKnownHostsFile=')).split('=')[1];
fs.writeFileSync(process.env.SSH_TEST_LOG, JSON.stringify({args, key, hosts, mode: fs.statSync(key).mode & 0o777}));
const result = spawnSync('sh', ['-c', args.at(-1)], {stdio: 'inherit'});
process.exit(result.status ?? 1);
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, "docker"),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_TEST_LOG"
printf '%s\\n' "\${APP_PORT:-unset}" >> "$PORT_TEST_LOG"
case "$*" in
  *" build app") [ "\${DOCKER_TEST_FAILURE:-}" != build ] ;;
  *" up "*) [ "\${DOCKER_TEST_FAILURE:-}" != health ] ;;
  *) exit 0 ;;
esac
`,
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    SSH_USERNAME: "deploy",
    SSH_HOST: "vps.example.com",
    SSH_IP: "",
    SSH_PORT: "2222",
    SSH_PRIVATE_KEY: "test-key",
    SSH_PRIVATE_KEY_FILE: "",
    SSH_KNOWN_HOSTS: "test-host",
    SSH_KNOWN_HOSTS_FILE: "",
    SSH_PROJECT_DIRECTORY: checkout,
    DEPLOY_SHA: sha,
    APP_PORT: "3456",
    PORT: "",
    SSH_TEST_LOG: join(root, "ssh.json"),
    DOCKER_TEST_LOG: join(root, "docker.log"),
    PORT_TEST_LOG: join(root, "port.log"),
  };
  return {
    root,
    checkout,
    sha,
    oldSha,
    env,
    run: (overrides = {}) =>
      spawnSync("bash", [deployScript], {
        env: { ...env, ...overrides },
        encoding: "utf8",
      }),
    log: () =>
      existsSync(env.DOCKER_TEST_LOG)
        ? readFileSync(env.DOCKER_TEST_LOG, "utf8")
        : "",
  };
}

test("SSH deploy checks out the tested main commit, quotes paths, pins host keys, and waits for health", (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(f.checkout, "rev-parse", "HEAD"), f.sha);
  assert.equal(
    readFileSync(join(f.checkout, "release.txt"), "utf8"),
    "second\n",
  );
  assert.equal(
    readFileSync(join(f.checkout, ".env.production"), "utf8"),
    "APP_PORT=4567\n",
  );
  assert.match(
    f.log(),
    /--env-file .env.production -f compose.production.yml config --quiet/,
  );
  assert.match(
    f.log(),
    /build app\n.*up -d --no-build --remove-orphans --wait --wait-timeout 180 app/,
  );
  assert.equal(
    readFileSync(f.env.PORT_TEST_LOG, "utf8")
      .trim()
      .split("\n")
      .every((port) => port === "3456"),
    true,
  );
  assert.doesNotMatch(f.log(), /prune|down/);
  const ssh = JSON.parse(readFileSync(f.env.SSH_TEST_LOG, "utf8"));
  assert.ok(ssh.args.includes("StrictHostKeyChecking=yes"));
  assert.ok(ssh.args.includes("BatchMode=yes"));
  assert.equal(ssh.mode, 0o600);
  assert.equal(existsSync(ssh.key), false);
  assert.equal(existsSync(ssh.hosts), false);
});
test("superseded commits cannot replace a newer main deployment", (t) => {
  const f = fixture(t);
  const result = f.run({ DEPLOY_SHA: f.oldSha });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Skipping superseded deployment/);
  assert.equal(git(f.checkout, "rev-parse", "HEAD"), f.oldSha);
  assert.equal(f.log(), "");
});
test("tracked VPS edits are preserved and stop deployment", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.checkout, "release.txt"), "local edit\n");
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /tracked changes/);
  assert.equal(
    readFileSync(join(f.checkout, "release.txt"), "utf8"),
    "local edit\n",
  );
  assert.equal(f.log(), "");
});
test("a directory pointing to Pronosticat cannot be deployed as Buscabolets", (t) => {
  const f = fixture(t);
  git(
    f.checkout,
    "remote",
    "set-url",
    "origin",
    "git@github.com:rogerclotet/pronosticat.git",
  );
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must belong to rogerclotet\/buscabolets/);
  assert.equal(git(f.checkout, "rev-parse", "HEAD"), f.oldSha);
  assert.equal(f.log(), "");
});
test("missing production environment stops before checkout", (t) => {
  const f = fixture(t);
  rmSync(join(f.checkout, ".env.production"));
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Create .env.production/);
  assert.equal(git(f.checkout, "rev-parse", "HEAD"), f.oldSha);
  assert.equal(f.log(), "");
});
test("a failed image build never replaces the running container", (t) => {
  const f = fixture(t);
  const result = f.run({ DOCKER_TEST_FAILURE: "build" });
  assert.notEqual(result.status, 0);
  assert.match(f.log(), /build app/);
  assert.doesNotMatch(f.log(), / up /);
});
test("failed container health fails the deployment and reports diagnostics", (t) => {
  const f = fixture(t);
  const result = f.run({ DOCKER_TEST_FAILURE: "health" });
  assert.notEqual(result.status, 0);
  assert.match(f.log(), /logs --tail=60 app/);
  assert.doesNotMatch(result.stdout, /is healthy/);
});
test("Pronosticat SSH_IP and PORT aliases work; an unset override leaves the VPS port in charge", (t) => {
  const f = fixture(t);
  const result = f.run({
    SSH_HOST: "",
    SSH_IP: "legacy.example.com",
    APP_PORT: "",
    PORT: "4568",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(f.env.PORT_TEST_LOG, "utf8"), /4568/);
  assert.match(
    readFileSync(f.env.SSH_TEST_LOG, "utf8"),
    /deploy@legacy.example.com/,
  );
  const second = f.run({ APP_PORT: "", PORT: "" });
  assert.equal(second.status, 0, second.stderr);
  assert.match(readFileSync(f.env.PORT_TEST_LOG, "utf8"), /unset/);
});
test("invalid configuration fails locally without connecting", (t) => {
  const f = fixture(t);
  for (const override of [
    { SSH_PRIVATE_KEY: "" },
    { SSH_KNOWN_HOSTS: "" },
    { SSH_PORT: "0" },
    { APP_PORT: "65536" },
    { DEPLOY_SHA: "main" },
    { SSH_PROJECT_DIRECTORY: "relative/path" },
  ]) {
    assert.notEqual(f.run(override).status, 0);
    assert.equal(existsSync(f.env.SSH_TEST_LOG), false);
  }
});
