// node vendor/deepmerge/test.js
const assert = require("node:assert");
const merge = require("./index.js");
assert.deepStrictEqual(merge({ a: { b: 1 }, l: [1] }, { a: { c: 2 }, l: [2] }), { a: { b: 1, c: 2 }, l: [1, 2] });
assert.deepStrictEqual(merge.all([{ a: 1 }, { b: 2 }, { a: 3 }]), { a: 3, b: 2 });
const merged = merge({}, JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"prototype": {"x": 1}}}'));
assert.strictEqual(({}).polluted, undefined);
assert.strictEqual(merged.polluted, undefined);
assert.strictEqual(Object.prototype.hasOwnProperty.call(merged, "constructor"), false);
console.log("deepmerge shim ok");
