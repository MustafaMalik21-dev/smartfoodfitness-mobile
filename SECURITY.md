# Security

Secret handling and leak prevention for the SmartFoodFitness mobile app.

## The rule: no secrets in the mobile bundle. Ever.

Everything the app ships with is public. A release build is a zip file — anyone
can pull the JavaScript bundle out of an APK or IPA and read every string in it:

```sh
unzip -p app.apk assets/index.android.bundle | grep -o 'sk-ant-[A-Za-z0-9_-]*'
```

Obfuscation, minification, `expo-secure-store`, base64 and split-up string
constants do not change this. If a credential is in the build, treat it as
published.

That means:

- **No third-party API keys in this repo.** Not in `src/config.js`, not in
  `app.json` `extra`, not in `EXPO_PUBLIC_*` variables, not in an EAS build
  secret that ends up inlined into the bundle. EAS build secrets are safe only
  for values used *during the build* (signing, native config) — never for values
  the JS reads at runtime.
- **Every third-party call goes through the backend.** The app talks only to
  `API_BASE_URL`; the backend holds the Anthropic, USDA and Wger keys as
  server-side environment variables (Railway) and proxies the calls. That is why
  `/api/ai/*` exists.
- **The only credential on the device is the user's own JWT**, issued by our
  backend at login, stored in `expo-secure-store` (Keychain / Keystore), and
  scoped to that one user.
- Committed config may contain **public identifiers** — the EAS `projectId`, the
  `u.expo.dev` update URL, bundle identifiers, BLE service UUIDs. Those are not
  secrets and are allowlisted in `.gitleaks.toml`.

## Automated prevention

Two dependency-free pieces, both version controlled:

| File | What it does |
| --- | --- |
| `.gitleaks.toml` | Rules for Anthropic keys, high-entropy key/token/secret assignments, AWS keys, PEM private-key blocks, JWT literals and GitHub tokens, plus an allowlist for this repo's public identifiers. |
| `.githooks/pre-commit` | Scans **staged** content before every commit and aborts if it looks like a secret. |

### Enable the hook (once per clone)

```sh
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit   # macOS / Linux only
```

`core.hooksPath` is per-clone local config, so every developer and every fresh
clone has to run it — that is the cost of keeping the hook in version control
instead of in the untracked `.git/hooks/`.

### Install gitleaks (recommended, not required)

```sh
brew install gitleaks                                    # macOS
scoop install gitleaks                                   # Windows
go install github.com/zricethezav/gitleaks/v8@latest     # any platform with Go
# or a prebuilt binary: https://github.com/gitleaks/gitleaks/releases
```

The hook works either way. Without gitleaks it falls back to a grep sweep of the
staged diff covering the highest-signal patterns only (Anthropic keys, AWS key
IDs, PEM blocks, JWTs, GitHub tokens, quoted high-entropy assignments) and tells
you how to install the real thing. A missing tool never blocks a commit.

Only **added** lines of staged content are inspected, so a commit that *removes*
a secret always goes through.

Manual scans:

```sh
gitleaks git --staged --config .gitleaks.toml    # what the hook runs (>= 8.19)
gitleaks git --config .gitleaks.toml             # entire history
gitleaks dir --config .gitleaks.toml             # working tree
```

If a finding is a false positive, add an entry to the `[allowlist]` in
`.gitleaks.toml` — do not disable the hook. In a genuine emergency,
`git commit --no-verify` bypasses it.

## Known exposure: the old Anthropic key

An Anthropic API key (`sk-ant-api03-…`) was hardcoded in `src/config.js` and
shipped in the app bundle. It was introduced in commit `6ab10ba` and is present
in every commit from there up to the commit that removes it.

**Status: revoked.** The key no longer authenticates against the Anthropic API,
so this is hygiene, not an open incident. `src/config.js` now holds only the
backend URL, and AI traffic goes through `/api/ai/*`.

### What is still true

The key remains readable in git history (`git log -p -- src/config.js`) and in
any clone, fork, or CI cache made before it was removed. Removing it from the
current file does not remove it from history.

### Options — the developer decides

1. **Leave history alone (reasonable here).** The key is dead, the repository is
   a university FYP with a small clone footprint, and rewriting history has real
   costs. Document it and move on.
2. **Rewrite history** with [`git-filter-repo`](https://github.com/newren/git-filter-repo)
   (preferred) or the [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/):

   ```sh
   # from a fresh clone — filter-repo rewrites in place and is not reversible
   git filter-repo --replace-text secrets.txt   # secrets.txt: literal==>REDACTED
   ```

   Understand the consequences before doing this:

   - **Every commit hash after the first rewritten commit changes.** Tags,
     branches and any commit SHA referenced in an issue, PR or write-up become
     invalid.
   - It requires a **force-push** (`git push --force-with-lease --all --tags`),
     which rewrites the published branch. Anyone with an existing clone must
     re-clone or reset; a normal `git pull` will produce a mess.
   - **Forks, existing clones, and PR refs keep the old objects.** On GitHub the
     unreachable objects can stay served through the API until garbage
     collection — you have to ask GitHub Support to purge them.
   - EAS build history and any CI logs that captured the old bundle are outside
     git and unaffected either way.

Do not attempt a rewrite as part of an unrelated change, and never on a branch
someone else is working on.

## If a key leaks again

1. **Revoke and rotate it first** — at the provider, immediately. Everything else
   is secondary.
2. Remove it from the code and route the call through the backend.
3. Set the new value as a server-side environment variable (Railway → Variables).
4. Decide about history using the section above.
5. Check what else shipped with it: the same bundle, the same build, the same
   commit.

## Reporting

This is a final-year project repository. Send anything security-relevant to the
maintainer directly rather than opening a public issue.
