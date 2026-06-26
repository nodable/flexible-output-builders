import type { MatcherView, Expression } from 'path-expression-matcher';
import type { EntityDecoderOptions } from '@nodable/entities';

// ─── Context ─────────────────────────────────────────────────────────────────

/**
 * Typed context object passed as the second argument to every value parser's
 * `parse(val, context)` call.
 */
export declare class Context {
  /** Tag or attribute name */
  elementName: string;
  /** Read-only path inspector provided by the XML parser */
  matcher: MatcherView | null;
  /** True when the element has no child elements; null when not yet determinable */
  isLeafNode: boolean | null;
  /** True when the value is an attribute value; false for tag text content */
  isAttribute: boolean | null;

  constructor(
    elementName: string,
    matcher: MatcherView | null,
    isLeafNode: boolean | null,
    isAttribute: boolean | null
  );
}

// ─── FinalValue ───────────────────────────────────────────────────────────────

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
 * import { FinalValue } from '@nodable/base-output-builder';
 *
 * class StopOnNull extends BaseValueParser {
 *   parse(val: unknown): unknown {
 *     if (val === 'null') return new FinalValue(null);
 *     return val;
 *   }
 * }
 */
export declare class FinalValue {
  value: unknown;
  constructor(value: unknown);
}

// ─── SharedContext ────────────────────────────────────────────────────────────

/**
 * Mutable key-value store shared with every value parser via `init(ctx)`.
 * A fresh instance is created per document parse — no stale state between runs.
 *
 * Well-known keys set by BaseOutputBuilder:
 * - `'xmlVersion'`    — numeric XML version from `<?xml version="…"?>`
 * - `'inputEntities'` — entity map from the DOCTYPE block
 */
export declare class SharedContext {
  set(key: string, value: unknown): void;
  get(key: string): unknown;
  /** Remove all entries. */
  clear(): void;
}

// ─── ValueParser interface ────────────────────────────────────────────────────

export interface ValueParser {
  parse(val: unknown, context?: Context): unknown;
  /** Optional: reset internal state before each parse run */
  reset?(): void;
  /** Optional: receive the SharedContext once per pipeline construction */
  init?(ctx: SharedContext): void;
}

// ─── BaseValueParser ─────────────────────────────────────────────────────────

/**
 * Recommended base class for all value parsers.
 *
 * Handles `IS_FINAL` and the `init(ctx)` / `reset()` lifecycle that the
 * pipeline calls automatically.
 *
 * @example
 * import { BaseValueParser, FinalValue } from '@nodable/base-output-builder';
 *
 * class MyParser extends BaseValueParser {
 *   constructor(options?: object, isFinal = false) {
 *     super(isFinal);
 *     this.options = options ?? {};
 *   }
 *   parse(val: unknown): unknown {
 *     const result = transform(val);
 *     return this.IS_FINAL ? new FinalValue(result) : result;
 *   }
 * }
 */
export declare class BaseValueParser implements ValueParser {
  /** When true, wrap return values in `new FinalValue(…)` to stop the pipeline. */
  IS_FINAL: boolean;
  /** The `SharedContext` injected by `init(ctx)`. Read XML version and entities from here. */
  ctx: SharedContext | undefined;

  constructor(IS_FINAL?: boolean);

  /**
   * Called by the pipeline after construction with the document's SharedContext.
   * Stores `ctx` on `this.ctx`. Override only if you need to pre-read something
   * at init time rather than lazily inside `parse()`.
   */
  init(ctx: SharedContext): void;
  reset(): void;
  parse(val: unknown, runTimeContext?: Context): unknown;
}

// ─── ValueParserPipeline ─────────────────────────────────────────────────────

/**
 * Owns a value-parser registry and a configured parser chain, and executes
 * them in order on demand.
 *
 * Builders receive two pre-built pipelines from their factory:
 *  - `tagsPipeline`  — for tag text content
 *  - `attrsPipeline` — for attribute values
 *
 * @example
 * const result = builder.tagsPipeline.run('  true  ', context); // → true
 */
export declare class ValueParserPipeline {
  valParsers: Array<string | ValueParser>;
  registry: ValueParserRegistry;
  sharedContext: SharedContext;

  constructor(
    valParsers: Array<string | ValueParser>,
    registry: ValueParserRegistry,
    sharedContext?: SharedContext,
  );

  /**
   * Execute the parser chain on `val`.
   * Returns early if any parser returns a {@link FinalValue}.
   */
  run(val: unknown, context?: Context): unknown;

  /** Reset all parsers in the chain. */
  resetAll(): void;

  /** Add or replace a named parser in this pipeline's registry. */
  register(name: string, instance: ValueParser): void;
}

// ─── ValueParserRegistry ─────────────────────────────────────────────────────

export declare class ValueParserRegistry {
  registered: Record<string, ValueParser>;

  register(name: string, parser: ValueParser): void;
  get(name: string): ValueParser;
  reset(name: string): void;
  resetAll(): void;
}

// ─── BaseOutputBuilder ───────────────────────────────────────────────────────

export declare class BaseOutputBuilder {
  matcher: MatcherView | null;
  parserOptions: object;
  builderOptions: object;
  registry: ValueParserRegistry;
  sharedContext: SharedContext;
  tagsPipeline: ValueParserPipeline;
  attrsPipeline: ValueParserPipeline;

  constructor(
    parserOptions: object,
    builderOptions: object,
    matcherView: MatcherView | null,
    registry: ValueParserRegistry,
    resetPipelines?: boolean,
  );

  addElement(tag: { name: string;[key: string]: unknown }): void;
  closeElement(): void;
  addAttribute(name: string, value: unknown, matcher: MatcherView): void;
  addValue(text: string): void;
  addComment(text: string): void;
  addLiteral(text: string): void;
  addRawValue(text: string): void;
  addInputEntities(entities: Record<string, string>): void;
  addDeclaration(name: string): void;
  addInstruction(name: string): void;

  onStopNode(
    tagDetail: { name: string; line: number; col: number; index: number },
    rawContent: string,
  ): void;
  onExit(exitInfo: {
    tagDetail: { name: string; line: number; col: number; index: number };
    matcher: MatcherView;
    depth: number;
  }): void;
  getOutput(): unknown;
}

// ─── BaseOutputBuilderFactory ────────────────────────────────────────────────

export declare class BaseOutputBuilderFactory {
  builderOptions: object;
  registry: ValueParserRegistry;

  constructor(builderOptions?: object);

  /**
   * Add or replace a named value parser in the shared registry.
   * Takes effect for all builder instances created after this call.
   */
  registerValueParser(name: string, instance: ValueParser): void;

  /**
   * Obtain a fresh builder instance. Called by XMLParser before each parse run.
   * Must be overridden by subclasses — the base throws `Error`.
   */
  getInstance(parserOptions: object, readonlyMatcher: MatcherView | null): BaseOutputBuilder;
}

// ─── Built-in value parsers ──────────────────────────────────────────────────

/**
 * Expands XML/HTML entity references. Options are passed directly to
 * `EntityDecoder` from `@nodable/entities` — see that package for the full
 * option reference.
 */
export declare class EntitiesValueParser extends BaseValueParser {
  constructor(options?: EntityDecoderOptions, isFinal?: boolean);
  parse(val: unknown, context?: Context): unknown;
  reset(): void;
}

export declare class NumberValueParser extends BaseValueParser {
  /** options supported by strnum library*/
  constructor(options?: any, isFinal?: boolean);
  parse(val: unknown, context?: Context): unknown;
}

export interface WSNormalizerOptions {
  /** Tag paths whose whitespace should be left untouched. */
  exclude?: Array<string | Expression>;
}

/**
 * Collapses whitespace runs (spaces, tabs, newlines) to a single space and
 * trims both ends. Replaces `'trim'` in the default chain.
 *
 * Skipped automatically when:
 * - value is not a string
 * - elementType is ATTRIBUTE
 * - under xml:space="preserve" scope
 * - tag path matches the exclusion list
 */
export declare class WSNormalizer extends BaseValueParser {
  constructor(options?: WSNormalizerOptions, isFinal?: boolean);
  parse(val: unknown, context?: Context): unknown;
}

export declare class BooleanParser extends BaseValueParser {
  constructor(trueList?: string[], falseList?: string[], isFinal?: boolean);
  parse(val: unknown, context?: Context): unknown;
}

/** Alias kept for backward compatibility — prefer WSNormalizer. */
export declare class Trim extends BaseValueParser {
  parse(val: unknown): unknown;
}