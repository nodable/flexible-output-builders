import type {
  // Context,
  ValueParser,
  ValueParserRegistry,
  BaseOutputBuilder,
  BaseOutputBuilderFactory,
  // SharedContext,
} from '@nodable/base-output-builder';
import type { Expression, MatcherView } from 'path-expression-matcher';


// ─── XmlNode ─────────────────────────────────────────────────────────────────

/**
 * A parsed XML node as produced by NodeTreeBuilder.
 *
 * - `elementname` — element name
 * - `child`       — ordered child array; empty for leaf nodes.
 *                   Inline text/comment/cdata entries appear here as
 *                   `{ [nameFor.text]: value }` objects in mixed content.
 * - `[groupBy]`   — attributes object (always present, empty `{}` when none)
 * - `text`        — only present on leaf nodes; holds the parsed text value
 */
export interface XmlNode {
  elementname: string;
  child: Array<XmlNode | Record<string, unknown>>;
  text?: unknown;
  /** Attributes grouped under the parser's `attributes.groupBy` key. */
  [groupBy: string]: unknown;
}

// ─── FactoryOptions ──────────────────────────────────────────────────────────

/**
 * Builder-level options passed to `NodeTreeBuilderFactory`.
 * Parser-level options (skip, nameFor, attributes prefix/groupBy, etc.)
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
   * Default: ['entity', 'number', 'boolean']
   */
  attributes?: {
    valueParsers?: Array<string | ValueParser>;
  };
  /**
   * When `true`, text is always stored as a `{ [nameFor.text]: value }` child
   * entry — even on pure leaf nodes. The `text` property is never set in this
   * mode. Default: false
   */
  textInChild?: boolean;
  /**
   * Called when any tag closes, before its node is pushed to the parent's
   * child array. Return a truthy value to drop the node from output entirely.
   */
  onClose?: (node: XmlNode, matcher: MatcherView) => unknown;
}

// ─── NodeTreeBuilder ─────────────────────────────────────────────────────────

export declare class NodeTreeBuilder extends BaseOutputBuilder {
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
  onExit(exitInfo: {
    tagDetail: { name: string; line: number; col: number; index: number };
    matcher: MatcherView;
    depth: number;
  }): void;
  /** Returns the single root node, or an array if the document has multiple root-level elements. */
  getOutput(): XmlNode | XmlNode[];
}

// ─── NodeTreeBuilderFactory ──────────────────────────────────────────────────

export declare class NodeTreeBuilderFactory extends BaseOutputBuilderFactory {
  constructor(options?: FactoryOptions);

  getInstance(
    parserOptions: object,
    readonlyMatcher: MatcherView | null,
  ): NodeTreeBuilder;
}