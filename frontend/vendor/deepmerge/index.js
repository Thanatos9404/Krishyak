"use strict";
// Drop-in for deepmerge 4.3.1 (MIT) used by jest-config. Upstream has no
// release fixing GHSA-gcqx-w48m-w2h4, so keys that could reach an object
// prototype are never copied.
const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);

function defaultIsMergeableObject(value) {
  if (!value || typeof value !== "object") return false;
  const tag = Object.prototype.toString.call(value);
  return tag !== "[object RegExp]" && tag !== "[object Date]" && !(typeof Symbol === "function" && Symbol.for && value.$$typeof === Symbol.for("react.element"));
}
function emptyTarget(value) {
  return Array.isArray(value) ? [] : {};
}
function clone(value, options) {
  return options.clone !== false && options.isMergeableObject(value)
    ? deepmerge(emptyTarget(value), value, options)
    : value;
}
function defaultArrayMerge(target, source, options) {
  return target.concat(source).map((element) => clone(element, options));
}
function keysOf(target) {
  const symbols = Object.getOwnPropertySymbols
    ? Object.getOwnPropertySymbols(target).filter((symbol) =>
        Object.propertyIsEnumerable.call(target, symbol),
      )
    : [];
  return Object.keys(target).concat(symbols).filter((key) => !UNSAFE.has(key));
}
function mergeObject(target, source, options) {
  const destination = {};
  if (options.isMergeableObject(target))
    for (const key of keysOf(target)) destination[key] = clone(target[key], options);
  for (const key of keysOf(source)) {
    const owned = Object.prototype.hasOwnProperty.call(target, key);
    if (owned && options.isMergeableObject(source[key]) && options.isMergeableObject(target[key])) {
      const custom = options.customMerge && options.customMerge(key);
      destination[key] = (typeof custom === "function" ? custom : deepmerge)(target[key], source[key], options);
    } else destination[key] = clone(source[key], options);
  }
  return destination;
}
function deepmerge(target, source, options) {
  options = Object.assign({}, options);
  options.arrayMerge = options.arrayMerge || defaultArrayMerge;
  options.isMergeableObject = options.isMergeableObject || defaultIsMergeableObject;
  options.cloneUnlessOtherwiseSpecified = clone;
  const sourceIsArray = Array.isArray(source);
  if (sourceIsArray !== Array.isArray(target)) return clone(source, options);
  if (sourceIsArray) return options.arrayMerge(target, source, options);
  return mergeObject(target, source, options);
}
deepmerge.all = function all(values, options) {
  if (!Array.isArray(values)) throw new Error("first argument should be an array");
  return values.reduce((previous, next) => deepmerge(previous, next, options), {});
};
module.exports = deepmerge;
module.exports.default = deepmerge;
