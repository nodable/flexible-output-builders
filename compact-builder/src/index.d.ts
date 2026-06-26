import type {
  // Context,
  ValueParser,
  ValueParserRegistry,
  BaseOutputBuilder,
  BaseOutputBuilderFactory,
  // SharedContext,
} from '@nodable/base-output-builder';
import type { Expression, MatcherView } from 'path-expression-matcher';

// ─── FactoryOptions ──────────────────────────────────────────────────────────

/**
 * Options passed to `CompactBuilderFactory`. These are builder-level concerns
 * only — parser-level options (skip, nameFor, attributes prefix/groupBy, etc.)
 * belong in the XML parser options object, not here.
 */
export interface FactoryOptions {
  /**
   * Value parser chain for tag text content.
   * Built-in names: 'entity', 'ws', 'boolean', 'number', 'trim', 'currency'.
   * Default: ['ws', 'entity', 'boolean', 'number']
   */
  tags?: {
    valueParsers?: Array<string | ValueParser>;
  };
  /**
   * Value parser chain for attribute values.
   * Built-in names: 'entity', 'ws', 'number', 'boolean', 'trim', 'currency'.
   * Default: ['entity', 'number', 'boolean']
   */
  attributes?: {
    valueParsers?: Array<string | ValueParser>;
  };
  /**
   * Force specific tags to always be arrays regardless of occurrence count.
   * Accepts path-expression strings (e.g. "..item") or compiled Expression objects.
   */
  alwaysArray?: Array<string | Expression>;
  /**
   * Callback to decide per-tag whether to force array wrapping.
   * Return `true` to force, `false` to veto, `undefined` to abstain.
   * Evaluated alongside `alwaysArray` with equal priority.
   */
  forceArray?: (matcher: MatcherView, isLeafNode: boolean | null) => boolean | undefined;
  /**
   * When `true`, always produce a `{ [nameFor.text]: value }` object for text
   * nodes instead of a plain string, ensuring consistent output structure.
   * Default: false
   */
  forceTextNode?: boolean;
  /**
   * String inserted between text chunks when a tag accumulates multiple text
   * segments (e.g. text interleaved with comments or CDATA). Default: ''
   */
  textJoint?: string;
}

// ─── CompactBuilder ──────────────────────────────────────────────────────────

export declare class CompactBuilder extends BaseOutputBuilder {
  constructor(
    parserOptions: object,
    builderOptions: FactoryOptions,
    readonlyMatcher: MatcherView | null,
    registry: ValueParserRegistry,
  );

  addElement(tag: { name: string }, matcher: MatcherView): void;
  closeElement(matcher: MatcherView): void;
  addValue(text: string, matcher: MatcherView): void;
  addInstruction(name: string): void;
  onStopNode(
    tagDetail: { name: string; line: number; col: number; index: number },
    rawContent: string,
  ): void;
  getOutput(): unknown;
}

// ─── CompactBuilderFactory ───────────────────────────────────────────────────

export declare class CompactBuilderFactory extends BaseOutputBuilderFactory {
  constructor(options?: FactoryOptions);

  getInstance(
    parserOptions: object,
    readonlyMatcher: MatcherView | null,
  ): CompactBuilder;
}