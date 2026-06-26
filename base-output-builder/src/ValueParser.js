import ValueParserRegistry from './ValueParserRegistry.js';
import BaseValueParser from './ValueParsers/BaseValueParser.js';

/**
 * Context object passed to every value parser's `parse(val, context)` call.
 */
export class Context {
  /**
   * @param {string}                elementName   Tag or attribute name
   * @param {import('path-expression-matcher').MatcherView} matcher  Read-only path inspector
   * @param {boolean|null}          isLeafNode    True when element has no child elements
   * @param {boolean}          isAttribute    True when attribute type
   */
  constructor(elementName, matcher, isLeafNode, isAttribute = false) {
    this.elementName = elementName;
    this.matcher = matcher;
    this.isLeafNode = isLeafNode;
    this.isAttribute = isAttribute;
  }
}

/**
 * Sentinel returned by a value parser to stop the pipeline immediately.
 *
 * When `ValueParserPipeline.run()` sees a `FinalValue` result it unwraps
 * `.value` and returns it without running any subsequent parsers.
 *
 * Whether to emit `FinalValue` is the parser's own decision, controlled by
 * its `IS_FINAL` constructor option (not injected by the pipeline).
 *
 * @example
 * import { FinalValue } from '@nodable/base-output-builder/ValueParser.js';
 *
 * class StopOnNull extends BaseValueParser {
 *   constructor(options, IS_FINAL) {
 *     super(IS_FINAL);
 *     this.options = options || {};
 *   }
 *   parse(val) {
 *     if (val === 'null') {
 *       return this.IS_FINAL ? new FinalValue(null) : null;
 *     }
 *     return val;
 *   }
 * }
 */
export class FinalValue {
  /** @param {*} value The resolved value to return from the pipeline */
  constructor(value) {
    this.value = value;
  }
}

/**
 * Mutable key-value store owned by `BaseOutputBuilder` and shared with every
 * value parser that opts in via `init(ctx)`.
 *
 * A fresh `SharedContext` is created for each document parse by
 * `BaseOutputBuilderFactory.getInstance()`, so there is no risk of stale
 * data from a previous document leaking into the next.
 *
 * ## Well-known keys (set by `BaseOutputBuilder`)
 * - `'xmlVersion'`    — numeric XML version from `<?xml version="…"?>`
 * - `'inputEntities'` — entity map from the DOCTYPE block
 *
 * ## Extension
 * Parsers may also write to the context to communicate with later parsers in
 * the same pipeline (e.g. a locale detector writing `'detectedLocale'` for a
 * downstream date formatter).
 *
 * @example
 * const ctx = new SharedContext();
 * ctx.set('xmlVersion', 1.1);
 * ctx.get('xmlVersion'); // → 1.1
 */
export class SharedContext {
  #data = {};

  /** @param {string} key  @param {*} value */
  set(key, value) { this.#data[key] = value; }

  /** @param {string} key  @returns {*} */
  get(key) { return this.#data[key]; }

  /**
   * Remove all entries.
   * Not needed when the factory creates a fresh SharedContext per parse
   * (the current approach), but available for alternative setups.
   */
  clear() { this.#data = {}; }
}

/**
 * Owns a value-parser registry and a configured parser chain, and executes
 * them in order on demand.
 *
 * Builders receive two pre-built pipelines from their factory:
 *  - `tagsPipeline`  — for tag text content
 *  - `attrsPipeline` — for attribute values
 *
 * Both pipelines share the same `SharedContext` instance and the same parser
 * instances from the registry. `init(ctx)` is called on every parser that
 * implements it when the pipeline is constructed, and again on any parser
 * added later via `register()`.
 *
 * Because a fresh pipeline is built for every document parse, parsers receive
 * an up-to-date `ctx` reference each time — no stale state.
 *
 * `IS_FINAL` is a parser-level decision set in each parser's own constructor,
 * not injected by the pipeline.
 *
 * @example
 * const ctx = new SharedContext();
 * const pipeline = new ValueParserPipeline(
 *   ['entity', 'ws', 'boolean', 'number'],
 *   registry,
 *   ctx,
 * );
 * const result = pipeline.run('  true  ', context); // → true
 */
export class ValueParserPipeline {
  /**
   * @param {Array<BaseValueParser>}  valParsers     Ordered parser names or instances
   * @param {ValueParserRegistry} registry       Map of name → parser instance
   * @param {SharedContext}         [sharedContext]
   */
  constructor(valParsers = [], registry, sharedContext = null) {
    this.valParsers = valParsers;
    this.registry = registry;
    this.sharedContext = sharedContext || new SharedContext();

    this._initAll(valParsers);
  }

  /**
   * Execute the parser chain on `val`.
   *
   * Each parser receives `(currentValue, context)`. If a parser returns a
   * {@link FinalValue} the chain stops and the wrapped value is returned.
   *
   * @param {*}       val
   * @param {Context} [runtimContext]
   * @returns {*}
   */
  run(val, runtimContext) {
    for (let i = 0; i < this.valParsers.length; i++) {
      let parser = this.valParsers[i];
      if (typeof parser === 'string') parser = this.registry.get(parser);
      if (parser) {
        const result = parser.parse(val, runtimContext);
        if (result instanceof FinalValue) return result.value;
        val = result;
      }
    }
    return val;
  }

  resetAll() {
    for (let i = 0; i < this.valParsers.length; i++) {
      let parser = this.valParsers[i];
      if (typeof parser === 'string') parser = this.registry.get(parser);
      if (parser) if (parser.reset && typeof parser.reset === 'function') parser.reset();
    }
  }

  /**
   * Add or replace a named parser in the registry.
   * If the instance implements `init()` and the pipeline has a `SharedContext`,
   * `init` is called immediately so the parser is ready before the next `run()`.
   *
   * @param {string} name
   * @param {object} instance  Must implement `parse(val, context?)`
   */
  register(name, instance) {
    this.registry.register(name, instance);
    if (instance.init) instance.init(this.sharedContext);
  }

  // ── private ──────────────────────────────────────────────────────────────

  /**
   * Call `init(sharedContext)` on each parser in `instances` that implements it.
   * Used only during construction to wire up the initial registry.
   *
   * A local `Set` deduplicates in case the same instance is registered under
   * multiple names (e.g. an alias). A module-level WeakSet is intentionally
   * NOT used: pipelines are rebuilt on every `getInstance()` call, so parsers
   * must receive `init()` fresh each parse with the new `SharedContext` ref.
   *
   * @param {object[]} instances
   */
  _initAll(instances) {
    if (!this.sharedContext) return;
    const seen = new Set();
    for (const p of instances) {
      let parserInstance = p;
      if (typeof p === 'string') parserInstance = this.registry.get(p);
      if (parserInstance && typeof parserInstance.init === 'function' && !seen.has(parserInstance)) {
        seen.add(parserInstance);
        parserInstance.init(this.sharedContext);
      }
    }
  }
}