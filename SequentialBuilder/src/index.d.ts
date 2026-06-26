import type {
  // Context,
  ValueParser,
  ValueParserRegistry,
  BaseOutputBuilder,
  BaseOutputBuilderFactory,
  // SharedContext,
} from '@nodable/base-output-builder';
import type { MatcherView } from 'path-expression-matcher';

// ─── XmlNode ─────────────────────────────────────────────────────────────────

/**
 * Internal node shape passed to the `onClose` callback.
 * Represents a tag's fully-built state at the moment it closes.
 */
export interface XmlNode {
  tagname: string;
  children: SequentialEntry[];
  text?: unknown;
  /** Attributes collected under the configured `attributes.groupBy` key. */
  [groupBy: string]: unknown;
}

// ─── SequentialEntry ─────────────────────────────────────────────────────────

/**
 * A single parsed XML entry as produced by SequentialBuilder.
 *
 * ```
 * {
 *   [tagName]: SequentialEntry[],   // children array (always present)
 *   [groupBy]?: Record<string,any>, // attributes (only when non-empty)
 *   text?: any                      // only on leaf nodes
 * }
 * ```
 */
export type SequentialEntry = Record<string, unknown>;

// ─── FactoryOptions ──────────────────────────────────────────────────────────

/**
 * Options passed to `SequentialBuilderFactory`. These are builder-level
 * concerns only — parser-level options (skip, nameFor, attributes
 * prefix/groupBy, etc.) belong in the XML parser options object, not here.
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
   * Default: ['entity', 'number', 'boolean']
   */
  attributes?: {
    valueParsers?: Array<string | ValueParser>;
  };
  /**
   * When `true`, text is always stored as a `{ [nameFor.text]: value }` child
   * entry — even on pure leaf nodes. The `text` sibling property is never set
   * in this mode. Default: false
   */
  textInChild?: boolean;
  /**
   * Called when any tag closes, before its entry is pushed to the parent.
   * Return a truthy value to drop the tag from output entirely.
   */
  onClose?: (node: XmlNode, matcher: MatcherView) => unknown;
}

// ─── SequentialBuilder ───────────────────────────────────────────────────────

export declare class SequentialBuilder extends BaseOutputBuilder {
  constructor(
    parserOptions: object,
    builderOptions: FactoryOptions,
    readonlyMatcher: MatcherView | null,
    registry: ValueParserRegistry,
  );

  addElement(tag: { name: string }): void;
  closeElement(): void;
  addValue(text: string): void;
  addComment(text: string): void;
  addLiteral(text: string): void;
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
  getOutput(): SequentialEntry[];
}

// ─── SequentialBuilderFactory ────────────────────────────────────────────────

export declare class SequentialBuilderFactory extends BaseOutputBuilderFactory {
  constructor(options?: FactoryOptions);

  getInstance(
    parserOptions: object,
    readonlyMatcher: MatcherView | null,
  ): SequentialBuilder;
}