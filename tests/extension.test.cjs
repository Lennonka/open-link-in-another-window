const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = resolve(__dirname, '..');
const source = name => readFileSync(resolve(root, name), 'utf8');
const event = () => ({ addListener() {} });

async function background(windows, incognitoAllowed = false) {
  let messageListener;
  const calls = [];
  const chrome = {
    runtime: {
      onInstalled: event(), onStartup: event(),
      onMessage: { addListener(listener) { messageListener = listener; } }
    },
    extension: { isAllowedIncognitoAccess(callback) { callback(incognitoAllowed); } },
    windows: {
      getAll: async () => windows,
      create: async options => { calls.push(['window', options]); },
      update: async (id, options) => { calls.push(['focus', id, options]); },
      onCreated: event(), onRemoved: event(), onFocusChanged: event()
    },
    tabs: {
      create: async options => { calls.push(['tab', options]); },
      onUpdated: event(), onDetached: event(), onAttached: event()
    },
    contextMenus: {
      removeAll() {}, remove() {}, create() {}, refresh() {}, onClicked: event()
    }
  };
  vm.runInNewContext(source('open-in-window-bg.js'), { chrome, console });
  return {
    calls,
    send(message) {
      return new Promise(resolve => {
        assert.equal(messageListener(message, {}, response => {
          resolve(JSON.parse(JSON.stringify(response)));
        }), true);
      });
    }
  };
}

const windowFixture = (id, extra = {}) => ({
  id, focused: false, incognito: false,
  tabs: [{ active: true, title: `Window ${id}`, favIconUrl: 'https://example.test/icon.png' }],
  ...extra
});

test('manifest references existing scripts and icons and has a valid Chrome version', () => {
  const manifest = JSON.parse(source('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  const parts = manifest.version.split('.');
  assert.ok(parts.length >= 1 && parts.length <= 4);
  assert.ok(parts.every(part => /^(0|[1-9]\d*)$/.test(part) && Number(part) <= 65535));
  assert.ok(parts.some(part => Number(part) > 0));
  const files = [manifest.background.service_worker,
    ...manifest.content_scripts.flatMap(script => script.js), ...Object.values(manifest.icons)];
  for (const file of files) assert.ok(existsSync(resolve(root, file)), `Missing asset: ${file}`);
});

test('window choices exclude the focused window and retain destination metadata', async () => {
  const app = await background([windowFixture(1, { focused: true }), windowFixture(2)]);
  const response = await app.send({ type: 'OIAW_GET_WINDOW_CHOICES' });
  assert.equal(response.ok, true);
  assert.deepEqual(response.windows, [{
    id: 2, title: 'Window 2', baseTitle: 'Window 2',
    favIconUrl: 'https://example.test/icon.png', tabCount: 1, incognito: false
  }]);
});

test('incognito destinations require access and keep their indicator when truncated', async () => {
  const windows = [windowFixture(1, { focused: true }), windowFixture(2, {
    incognito: true, tabs: [{ active: true, title: 'A'.repeat(100) }]
  })];
  const hidden = await (await background(windows)).send({ type: 'OIAW_GET_WINDOW_CHOICES' });
  assert.deepEqual(hidden.windows, []);
  assert.equal(hidden.hiddenIncognitoCount, 1);
  const visible = await (await background(windows, true)).send({ type: 'OIAW_GET_WINDOW_CHOICES' });
  assert.equal(visible.windows[0].incognito, true);
  assert.equal(visible.windows[0].title.length, 60);
  assert.ok(visible.windows[0].title.endsWith(' · Incognito'));
});

test('opening in an existing window creates an active tab then focuses the window', async () => {
  const app = await background([]);
  assert.deepEqual(await app.send({ type: 'OIAW_OPEN_LINK', target: 'window', windowId: 2,
    url: 'https://example.test/' }), { ok: true });
  assert.equal(JSON.stringify(app.calls), JSON.stringify([
    ['tab', { windowId: 2, url: 'https://example.test/', active: true }],
    ['focus', 2, { focused: true }]
  ]));
});

test('opening in a new window uses the supplied URL', async () => {
  const app = await background([]);
  assert.deepEqual(await app.send({ type: 'OIAW_OPEN_LINK', target: 'new-window',
    url: 'https://example.test/' }), { ok: true });
  assert.equal(JSON.stringify(app.calls), JSON.stringify([
    ['window', { url: 'https://example.test/' }]
  ]));
});

test('invalid and unknown messages are rejected without opening anything', async () => {
  const app = await background([]);
  assert.deepEqual(await app.send(null), { ok: false, error: 'Invalid message' });
  assert.deepEqual(await app.send({ type: 'UNKNOWN' }), { ok: false, error: 'Unknown message type' });
  assert.deepEqual(app.calls, []);
});
