import type { Writable } from 'node:stream';
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
 * A single parsed XML entry as produced by SequentialStreamBuilder.
 * Identical shape to SequentialBuilder — the two are drop-in replacements.
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
 * Builder-level options shared with SequentialBuilder.
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

// ─── StreamBuilderOptions ────────────────────────────────────────────────────

/**
 * Options passed to `SequentialStreamBuilderFactory`.
 * Extends `FactoryOptions` with stream-specific properties.
 * Exactly one of `stream` or `onChunk` must be provided.
 */
export interface StreamBuilderOptions extends FactoryOptions {
  /**
   * A Node.js Writable stream. Chunks of the JSON array are written via
   * `stream.write(chunk: string)`.
   * Mutually exclusive with `onChunk`.
   */
  stream?: Writable;
  /**
   * Callback invoked with each string chunk as the parse progresses.
   * Use when you don't have a Writable (e.g. accumulate a buffer, send over WebSocket).
   * Mutually exclusive with `stream`.
   */
  onChunk?: (chunk: string) => void;
  /**
   * Spacing argument forwarded to `JSON.stringify()`.
   * Omit for compact output; pass `2` for human-readable indented output.
   */
  space?: number | string;
}

// ─── SequentialStreamBuilderFactory ─────────────────────────────────────────

/**
 * Stream variant of SequentialBuilderFactory. Instead of accumulating the full
 * parse tree in memory, each top-level XML element is serialised to JSON and
 * emitted to the configured `stream` or `onChunk` callback as soon as its
 * closing tag is seen.
 *
 * Wire format — a JSON array written incrementally:
 * ```
 * [
 *   { "root": [...] },    ← emitted when the first top-level tag closes
 *   { "other": [...] }    ← emitted when the second top-level tag closes
 * ]                       ← closing bracket written by getOutput()
 * ```
 *
 * IMPORTANT: `parser.parse()` is synchronous. All chunk emissions happen
 * inline during `parse()`. The stream must be open before `parse()` is called;
 * calling `stream.end()` is the caller's responsibility after `parse()` returns.
 *
 * @example
 * ```ts
 * import fs from 'node:fs';
 * import XMLParser from '@nodable/flexible-xml-parser';
 * import { SequentialStreamBuilderFactory } from '@nodable/sequential-stream-builder';
 *
 * const out = fs.createWriteStream('output.json');
 * out.on('open', () => {
 *   const parser = new XMLParser({
 *     OutputBuilder: new SequentialStreamBuilderFactory({ stream: out }),
 *   });
 *   parser.parse(xmlString);
 *   out.end();
 * });
 * ```
 */
export declare class SequentialStreamBuilderFactory extends BaseOutputBuilderFactory {
  constructor(options: StreamBuilderOptions);

  getInstance(
    parserOptions: object,
    readonlyMatcher: MatcherView | null,
  ): SequentialStreamBuilder;
}

// ─── SequentialStreamBuilder ─────────────────────────────────────────────────

/**
 * Builder instance created by `SequentialStreamBuilderFactory`.
 * Not intended for direct instantiation — use the factory.
 */
export declare class SequentialStreamBuilder extends BaseOutputBuilder {
  constructor(
    parserOptions: object,
    builderOptions: FactoryOptions,
    readonlyMatcher: MatcherView | null,
    registry: ValueParserRegistry,
    emit: (chunk: string) => void,
    space: number | string | undefined,
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
  /** Always returns `null` — output is streamed, not held in memory. */
  getOutput(): null;
}