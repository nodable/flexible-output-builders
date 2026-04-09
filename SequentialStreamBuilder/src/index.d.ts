import type { Writable } from 'node:stream';
import type {
  FactoryOptions,
  SequentialEntry,
  ValueParser,
} from './index.js';

/**
 * Options accepted by SequentialStreamBuilderFactory.
 *
 * Extends FactoryOptions with the stream-specific properties.
 * Exactly one of `stream` or `onChunk` must be provided.
 */
export interface StreamBuilderOptions extends FactoryOptions {
  /**
   * A Node.js Writable stream.  Chunks of the JSON array are written to it
   * via stream.write(chunk: string).
   *
   * Mutually exclusive with `onChunk`.
   */
  stream?: Writable;

  /**
   * A callback invoked with each string chunk as the parse progresses.
   * Use this when you don't have a Writable but want to handle output
   * yourself (e.g. accumulate into a buffer, send over a WebSocket, …).
   *
   * Mutually exclusive with `stream`.
   */
  onChunk?: (chunk: string) => void;

  /**
   * Spacing argument forwarded to JSON.stringify().
   * Omit (or pass undefined) for compact output.
   * Pass 2 for human-readable indented output.
   */
  space?: number | string;
}

/**
 * SequentialStreamBuilderFactory
 *
 * Stream variant of SequentialBuilderFactory.  Instead of accumulating the
 * full parse tree in memory, each top-level XML element is serialised to JSON
 * and emitted to the configured `stream` or `onChunk` callback as soon as its
 * closing tag is seen.
 *
 * Wire format — a JSON array written incrementally:
 *
 *   [               ← emitted together with the first top-level entry
 *     { "root": [...] }
 *   ]               ← emitted by getOutput() (called by the parser after parse())
 *
 * The shape of each entry is identical to SequentialBuilder so the two
 * builders are drop-in replacements for each other.
 *
 * @example
 * ```ts
 * import fs from 'node:fs';
 * import XMLParser from '@nodable/flexible-xml-parser';
 * import SequentialStreamBuilderFactory from './SequentialStreamBuilder.js';
 *
 * const out = fs.createWriteStream('output.json');
 *
 * out.on('open', () => {
 *   const parser = new XMLParser({
 *     OutputBuilder: new SequentialStreamBuilderFactory({ stream: out }),
 *   });
 *
 *   parser.parse(xmlString);   // synchronous — all writes happen here
 *
 *   out.end();                 // caller closes the stream
 * });
 * ```
 */
export default class SequentialStreamBuilderFactory {
  constructor(options: StreamBuilderOptions);

  getInstance(
    parserOptions: FactoryOptions,
    readonlyMatcher: unknown,
  ): SequentialStreamBuilderInstance;

  registerValueParser(name: string, parser: ValueParser): void;
}

export interface SequentialStreamBuilderInstance {
  addElement(tag: { name: string }): void;
  closeElement(): void;
  addValue(text: string): void;
  addAttribute(name: string, value: unknown): void;
  addComment(text: string): void;
  addLiteral(text: string): void;
  addDeclaration(): void;
  addInstruction(name: string): void;
  addInputEntities(entities: object): void;

  onStopNode?(
    tagDetail: { name: string; line: number; col: number; index: number },
    rawContent: string,
    matcher: unknown,
  ): void;

  /**
   * Closes the JSON array and returns null.
   * All output has already been streamed; there is nothing to return in memory.
   */
  getOutput(): null;

  /**
   * Called by the parser when exitIf returns true.
   * Flushes and closes the JSON array, identical to getOutput().
   */
  onExit(exitInfo: {
    tagDetail: { name: string; line: number; col: number; index: number };
    matcher: unknown;
    depth: number;
  }): void;

  registeredValParsers: Record<string, ValueParser>;
}

export { SequentialEntry, FactoryOptions };