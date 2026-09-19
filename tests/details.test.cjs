const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const script = fs.readFileSync(path.join(__dirname, '..', 'PornhubScript.js'), 'utf8');
const code = script.slice(
  script.indexOf('function parseInteractionCount('),
  script.indexOf('//Source Methods'),
);
const context = vm.createContext({});
vm.runInContext(code, context);

test('interaction counters accept the numeric schema now returned by video pages', () => {
  assert.equal(context.interactionCountFromLdJson({
    interactionStatistic: [{ userInteractionCount: 32900 }],
  }), 32900);
});

test('interaction counters remain compatible with formatted text and suffixes', () => {
  assert.equal(context.parseInteractionCount('1,234,567'), 1234567);
  assert.equal(context.parseInteractionCount('32.9K'), 32900);
});

test('single-object and missing interaction metadata are safe', () => {
  assert.equal(context.interactionCountFromLdJson({
    interactionStatistic: { userInteractionCount: '42' },
  }), 42);
  assert.equal(context.interactionCountFromLdJson({}), 0);
});
