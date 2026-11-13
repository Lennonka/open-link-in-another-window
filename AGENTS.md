# Project guide

This repository is a Chrome Manifest V3 extension, **Open Link In Another Window**.
It uses plain JavaScript and browser APIs, with no build step or runtime dependencies.

- `manifest.json`: extension metadata, permissions, and entry points.
- `open-in-window-bg.js`: service worker, destination discovery, context menu, and link opening.
- `shift-click-picker.js`: Shift+click interception and Shadow DOM picker.
- `icons/`: packaged extension icons.
- `tests/`: local checks using Node's built-in test runner and mocked Chrome APIs.

## Validation

Use Node.js 22 or newer. Run these commands from the repository root before
finishing changes; no dependency installation is needed:

```sh
node --check open-in-window-bg.js
node --check shift-click-picker.js
node --test
```

These check JavaScript syntax, manifest assets/version, and background behavior.
Keep checks local; do not add GitHub Actions unless requested.
Add behavior tests for changes to routing or destination discovery.

Browser UI changes also need a manual check: load this directory as an unpacked
extension, open multiple Chrome windows, and exercise right-click and Shift+click.
Check direct routing with one other window, the picker with multiple destinations,
New window, dismissal, and Incognito where relevant. Report when browser testing
was not performed; Node mocks do not verify browser integration or picker rendering.

## Version bumping

`manifest.json` is the single source of truth for the extension version.

- Bump the manifest version for changes to shipped behavior, UI, permissions, or assets.
- Documentation, test-only, and development tooling changes do not require a bump.
- Use exactly `major.minor`: increment major for breaking changes and minor for
  non-breaking changes, including fixes and features. Reset minor to zero when
  incrementing major. Do not use a patch component.
- For example, `2.0` becomes `2.1` for a non-breaking change or `3.0` for a breaking
  change.
- Use numeric components without leading zeros, each between 0 and 65535. Never
  decrease a released version.
- Bump the version once per feature branch that requires a bump, not per commit
  or file. If the branch already includes a version bump, reuse it; adjust it to
  a major bump if the branch introduces breaking changes.
- Run the validation commands above after bumping and mention the new version in
  the handoff.

## Implementation conventions

Keep the extension dependency-free and preserve other click modifier combinations.
Keep Chrome API operations in the service worker and page UI in the content script.
Use DOM construction and `textContent` for page-derived labels. Preserve Incognito
access filtering and its visible indicator. Avoid new permissions unless needed
for the requested functionality and explain any permission change.
