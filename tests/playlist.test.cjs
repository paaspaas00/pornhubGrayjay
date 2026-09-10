const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const script = fs.readFileSync(path.join(__dirname, '..', 'PornhubScript.js'), 'utf8');
const code = script.slice(
  script.indexOf('function playlistIdFromUrl('),
  script.indexOf('source.isContentDetailsUrl ='),
);

function model(type) {
  return class {
    constructor(value, ...rest) {
      if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(this, value);
      else { this.value = value; this.rest = rest; }
      this.plugin_type = type;
    }
  };
}

function fixture(parsedVideos = []) {
  const title = { textContent: 'A public playlist' };
  const author = {
    textContent: 'Creator name',
    getAttribute(name) { return name === 'href' ? '/users/creator-name' : null; },
  };
  const document = {
    getElementById(id) { return id === 'playlistWrapper' ? {} : null; },
    querySelector(selector) {
      if (selector.includes('watchPlaylist')) return title;
      if (selector.includes('usernameWrap')) return author;
      return null;
    },
  };
  const requests = [];
  const context = vm.createContext({
    URL_BASE: 'https://video.example',
    PLATFORM: 'VideoExample',
    config: { id: 'plugin-id' },
    source: {},
    ScriptException: Error,
    normalizePornhubUrl(url) { return url.replace('https://de.video.example', 'https://video.example'); },
    domParser: { parseFromString() { return document; } },
    getVideos() { return { videos: parsedVideos }; },
    httpGET(url) { requests.push(url); return '<html></html>'; },
    PlatformID: model('PlatformID'),
    Thumbnail: model('Thumbnail'),
    Thumbnails: model('Thumbnails'),
    PlatformAuthorLink: model('PlatformAuthorLink'),
    PlatformVideo: model('PlatformVideo'),
    PlatformPlaylistDetails: model('PlatformPlaylistDetails'),
    VideoPager: class {
      constructor(results, hasMore) {
        this.plugin_type = 'VideoPager';
        this.results = results;
        this.hasMore = hasMore;
      }
    },
  });
  vm.runInContext(code, context);
  return { context, requests };
}

test('recognizes canonical, localized, and query playlist links only on the platform host', () => {
  const { context } = fixture();
  assert.equal(context.source.isPlaylistUrl('https://video.example/playlist/25241'), true);
  assert.equal(context.source.isPlaylistUrl('https://de.video.example/playlist/25241?x=1'), true);
  assert.equal(context.source.isPlaylistUrl('https://video.example/playlist?id=25241'), true);
  assert.equal(context.source.isPlaylistUrl('https://other.example/playlist/25241'), false);
  assert.equal(context.source.isPlaylistUrl('https://video.example/playlist/not-a-number'), false);
});

test('returns finite playlist details with deduplicated playable videos', () => {
  const videos = [{
    id: '10',
    title: 'First video',
    thumbnailUrl: 'https://cdn.example/thumb.jpg',
    duration: 42,
    views: 100,
    videoUrl: '/view_video.php?viewkey=abc&pkey=25241',
    authorInfo: { authorName: 'Uploader', channel: '/model/uploader' },
  }];
  const { context, requests } = fixture([videos[0], { ...videos[0] }]);
  const result = context.source.getPlaylist('https://video.example/playlist?id=25241');
  assert.deepEqual(requests, ['https://video.example/playlist/25241']);
  assert.equal(result.name, 'A public playlist');
  assert.equal(result.url, 'https://video.example/playlist/25241');
  assert.equal(result.videoCount, 1);
  assert.equal(result.contents.results.length, 1);
  assert.equal(result.contents.hasMore, false);
  assert.equal(result.contents.results[0].url, 'https://video.example/view_video.php?viewkey=abc&pkey=25241');
});

test('rejects unavailable or private playlist pages instead of importing unrelated cards', () => {
  const { context } = fixture();
  context.domParser.parseFromString = () => ({
    getElementById() { return null; },
    querySelector() { return null; },
  });
  assert.throws(() => context.source.getPlaylist('https://video.example/playlist/25241'), /unavailable/);
});
