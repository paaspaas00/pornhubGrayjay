const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const script = fs.readFileSync(path.join(__dirname, '..', 'PornhubScript.js'), 'utf8');
function extract(start, end) { return script.slice(script.indexOf(start), script.indexOf(end)); }
function fixture(response) {
  let calls = 0;
  const context = vm.createContext({
    URL_BASE: 'https://video.example', headers: { Cookie: 'test' }, state: { token: 'test' },
    ScriptException: Error, log() {}, isBotChallenge() { return false; },
    http: { GET() { calls++; return response; } },
    PornhubVideoPager: class { constructor(results, hasMore) { this.results = results; this.hasMore = hasMore; } },
  });
  vm.runInContext(extract('function buildQuery(', 'function selectedFilterValue('), context);
  vm.runInContext(extract('function httpGET(', 'function parseNumberSuffix('), context);
  vm.runInContext(extract('function getVideoPager(', 'function getVideos('), context);
  return { context, calls: () => calls };
}
test('query values round trip without injecting parameters or fragments', () => {
  const { context } = fixture();
  const query = 'A & B #1 + 50% / caffè 日本語';
  const result = context.buildQuery({ search: query, page: 1, empty: '', absent: null, zero: 0 });
  const parsed = new URLSearchParams(result);
  assert.equal(parsed.get('search'), query);
  assert.equal(parsed.get('page'), '1');
  assert.equal(parsed.get('zero'), '0');
  assert.equal(parsed.has('empty'), false);
  assert.equal(parsed.size, 3);
  assert.equal(result.includes(' '), false);
  assert.equal(result.includes('#'), false);
});
test('an empty search ends paging without retrying or parsing recommendations', () => {
  const f = fixture({ code: 404, isOk: false, body: '<html>Recommendation cards</html>' });
  const pager = f.context.getVideoPager('/video/search', { search: 'no matches' }, 1);
  assert.equal(pager.results.length, 0);
  assert.equal(pager.hasMore, false);
  assert.equal(f.calls(), 1);
});
test('404 remains an error unless the endpoint explicitly allows an empty result', () => {
  const f = fixture({ code: 404, isOk: false, body: '' });
  assert.throws(() => f.context.httpGET('https://video.example/watch', { retries: 0 }), /404/);
});
test('server errors are not converted to empty searches', () => {
  const f = fixture({ code: 503, isOk: false, body: '' });
  assert.throws(() => f.context.httpGET('https://video.example/search', { retries: 0, emptyOnNotFound: true }), /503/);
});
test('successful responses are unchanged', () => {
  const f = fixture({ code: 200, isOk: true, body: '<html>Search results</html>' });
  assert.equal(f.context.httpGET('https://video.example/search', { emptyOnNotFound: true }), '<html>Search results</html>');
});
