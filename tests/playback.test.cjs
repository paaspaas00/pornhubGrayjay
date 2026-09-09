const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const script = fs.readFileSync(path.join(__dirname, '..', 'PornhubScript.js'), 'utf8');
const code = script.slice(script.indexOf('function playbackHeaders('), script.indexOf('source.getContentDetails ='));
function fixture(statuses, definitions) {
  const pageRequests = [], mediaRequests = [];
  const context = vm.createContext({
    URL_BASE: 'https://video.example', headers: { 'User-Agent': 'test-agent', Cookie: 'private' },
    supportedResolutions: { 720: { width: 1280, height: 720 } }, ScriptException: Error,
    httpGET(url) {
      pageRequests.push(url);
      return 'var flashvars_1 = ' + JSON.stringify({ mediaDefinitions: definitions || [{
        format: 'hls', defaultQuality: true, quality: '720', videoUrl: `https://cdn.example/${pageRequests.length}.m3u8`,
      }] }) + ';';
    },
    http: { GET(url, headers) {
      mediaRequests.push({ url, headers });
      const code = statuses.shift();
      return { code, isOk: code === 200, body: code === 200 ? '#EXTM3U\n' : '' };
    } },
  });
  vm.runInContext(code, context);
  return { context, pageRequests, mediaRequests };
}
test('stale edge refreshes the page and returns a fresh validated source', () => {
  const f = fixture([410, 200]);
  const result = f.context.loadPlaybackPage('https://video.example/watch?id=1');
  assert.equal(result.definitions[0].videoUrl, 'https://cdn.example/2.m3u8');
  assert.match(f.pageRequests[1], /&_=\d+$/);
  assert.equal(f.mediaRequests[0].headers['User-Agent'], 'test-agent');
  assert.equal(f.mediaRequests[0].headers.Cookie, undefined);
});
test('healthy streams require only one page and one manifest', () => {
  const f = fixture([200]);
  f.context.loadPlaybackPage('https://video.example/watch');
  assert.equal(f.pageRequests.length, 1);
  assert.equal(f.mediaRequests.length, 1);
});
test('permanent edge failure is bounded and reported', () => {
  const f = fixture([410, 410, 410]);
  assert.throws(() => f.context.loadPlaybackPage('https://video.example/watch'), /HTTP 410/);
  assert.equal(f.pageRequests.length, 3);
});
test('progressive formats cannot be mislabeled as HLS', () => {
  const f = fixture([], [{ format: 'mp4', defaultQuality: true, quality: '720', videoUrl: 'https://cdn.example/video.mp4' }]);
  assert.throws(() => f.context.loadPlaybackPage('https://video.example/watch'), /no supported playback streams/);
  assert.equal(f.mediaRequests.length, 0);
});
