import { Expression, ExpressionSet } from 'path-expression-matcher';

const defaultOptions = {
  nameFor: {
    // text: "#text",
    // comment: "",
    // cdata: "",
  },
  skip: {
    // declaration: false,
    // pi: false,
    // attributes: true,
    // cdata: false,
    // comment: false,
    // nsPrefix: false,
    // tags: false,
  },
  tags: {
    valueParsers: [],
    // stopNodes: [],
  },
  attributes: {
    // prefix: "@_",
    // suffix: "",
    // groupBy: "",
    valueParsers: [],
  },
  textJoint: "",
  /**
   * Array of strings (tag names) or Expression objects.
   * Any match votes true; no match abstains (does not veto).
   * Combined with forceArray using equal-priority voting:
   * - Either explicit false → false (veto wins)
   * - Any true, none false → true
   * - All abstain → false (default)
   */
  alwaysArray: [],
  /**
   * Function to determine if a tag should be forced into an array.
   * Called with (matcher, isLeafNode) where:
   * - matcher: ReadOnlyMatcher - path matcher for current tag
   * - isLeafNode: boolean|null - null when not yet determinable
   * Returns: boolean - true to force array, false to veto, undefined to abstain
   */
  forceArray: null,

  /**
   * Boolean flag that forces creation of a text node for every tag.
   * When true, a text node is always created under nameFor.text even if
   * the tag has no other children or attributes.
   * Default: false (text node created only when tag has attributes or children)
   */
  forceTextNode: false,
};

// Default chains: replaceEntities first (expand references), then type coercion.
const defaultTagParsers = ["ws", "entity", "boolean", "number"];
const defaultAttrParsers = ["entity", "number", "boolean"];


export function buildOptions(options) {
  const finalOptions = deepClone(defaultOptions);

  if (!options || options.tags?.valueParsers === undefined) {
    finalOptions.tags.valueParsers = [...defaultTagParsers];
  }
  if (!options || options.attributes?.valueParsers === undefined) {
    finalOptions.attributes.valueParsers = [...defaultAttrParsers];
  }

  // Always build _alwaysArraySet so _resolveForceArray never crashes on a missing set.
  // Uses the user-supplied alwaysArray if provided, otherwise the default empty array.
  const alwaysArraySource = Array.isArray(options?.alwaysArray)
    ? options.alwaysArray
    : finalOptions.alwaysArray;
  const alwaysArraySet = new ExpressionSet();
  for (const entry of alwaysArraySource) {
    normalizeEntry(entry, 'alwaysArray', alwaysArraySet);
  }
  alwaysArraySet.seal();
  finalOptions._alwaysArraySet = alwaysArraySet;

  if (options) {
    copyProperties(finalOptions, options);
  }

  return finalOptions;
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const clone = {};
  for (const key of Object.keys(obj)) {
    clone[key] = deepClone(obj[key]);
  }
  return clone;
}

function copyProperties(target, source) {
  for (const key of Object.keys(source)) {
    // Guard against prototype pollution via option keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

    if (typeof source[key] === 'function') {
      target[key] = source[key];
    } else if (Array.isArray(source[key])) {
      target[key] = source[key];
    } else if (typeof source[key] === 'object' && source[key] !== null) {
      if (typeof target[key] !== 'object' || target[key] === null) {
        target[key] = {};
      }
      copyProperties(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}


function normalizeEntry(entry, optionName, set) {
  let pattern;

  if (typeof entry === 'string') {
    if (entry.length === 0) throw new Error(`${optionName} expression cannot be empty`);
    pattern = entry;
  } else if (typeof entry?.pattern === 'string' && entry.pattern.length > 0 && Array.isArray(entry?.segments)) {
    // Duck-type as Expression — avoids instanceof failure when the caller's copy of
    // path-expression-matcher resolves to a different module instance than ours
    // (e.g. parent project has its own node_modules/ copy, or CJS vs ESM mismatch).
    pattern = entry.toString();
  } else {
    // console.log(entry);
    // console.log(entry instanceof Expression);
    // console.log(typeof entry);
    throw new Error(
      `Invalid ${optionName} entry: expected a string, or Expression.`
    );
  }

  const expr = new Expression(pattern);
  set.add(expr);
  return expr;
}