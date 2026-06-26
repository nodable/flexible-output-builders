import { buildOptions } from './ParserOptionsBuilder.js';
import { BaseOutputBuilder, BaseOutputBuilderFactory, Context } from '@nodable/base-output-builder';
import { ValueParserPipeline } from '@nodable/base-output-builder';

/**
 * SequentialStreamBuilderFactory
 *
 * Stream variant of SequentialBuilderFactory.
 *
 * Instead of accumulating all parsed entries in memory and returning them via
 * getOutput(), this builder emits each **top-level entry** to a Writable stream
 * (or a plain callback) as soon as its closing tag is processed.  Nested nodes
 * are still kept in memory during parsing — you cannot emit partial JSON — but
 * they are released the moment the root-level element closes.
 *
 * The wire format is a **JSON array written incrementally**:
 *
 *   [                          ← written on first entry
 *     { "root": [...] },       ← written when the first top-level tag closes
 *     { "other": [...] }       ← written when the second top-level tag closes
 *   ]                          ← written when getOutput() is called (end of parse)
 *
 * This matches the shape of SequentialBuilder.getOutput() so the two builders
 * are drop-in replacements for each other.
 *
 * Options (in addition to all SequentialBuilderFactory options):
 *
 *   stream   {Writable}  – Node.js Writable stream.  Mutually exclusive with onChunk.
 *   onChunk  {Function}  – Callback invoked with each string chunk.
 *                          Mutually exclusive with stream.
 *   space    {number|string} – JSON.stringify spacing (default: undefined → compact).
 *
 * Exactly one of `stream` or `onChunk` must be provided.
 *
 * Usage:
 *
 *   import fs from 'fs';
 *   import XMLParser from '@nodable/flexible-xml-parser';
 *   import SequentialStreamBuilderFactory from './SequentialStreamBuilder.js';
 *
 *   const out = fs.createWriteStream('output.json');
 *
 *   out.on('open', () => {
 *     const parser = new XMLParser({
 *       OutputBuilder: new SequentialStreamBuilderFactory({ stream: out }),
 *     });
 *
 *     parser.parse(xmlString);   // synchronous — all onChunk calls fire here
 *
 *     out.end();                 // flush + close after parse() returns
 *   });
 *
 * IMPORTANT — parser.parse() is synchronous.
 * All chunk emissions happen inline during parse().  The stream must be open
 * (writable) before parse() is called, and end() / finish() is the caller's
 * responsibility after parse() returns.
 */
export default class SequentialStreamBuilderFactory extends BaseOutputBuilderFactory {
  constructor(options = {}) {
    super();

    if (!options.stream && typeof options.onChunk !== 'function') {
      throw new TypeError(
        'SequentialStreamBuilderFactory: provide either `stream` (Writable) or `onChunk` (Function).'
      );
    }
    if (options.stream && typeof options.onChunk === 'function') {
      throw new TypeError(
        'SequentialStreamBuilderFactory: `stream` and `onChunk` are mutually exclusive.'
      );
    }

    // Separate stream/formatting options from builder options
    const { stream, onChunk, space, ...builderOptions } = options;

    this._stream = stream ?? null;
    this._onChunk = onChunk ?? null;
    this._space = space ?? undefined;

    this.builderOptions = buildOptions(builderOptions);
  }

  getInstance(parserOptions, readonlyMatcher) {

    // Each parse run gets its own builder instance, with a fresh emit function
    // that writes to the configured destination.
    const emit = this._stream
      ? (chunk) => this._stream.write(chunk)
      : this._onChunk;

    return new SequentialStreamBuilder(
      parserOptions,
      this.builderOptions,
      readonlyMatcher,
      this.registry,
      emit,
      this._space,
    );
  }
}

// ---------------------------------------------------------------------------

export class SequentialStreamBuilder extends BaseOutputBuilder {
  /**
   * @param {object}                options   – merged + defaulted options from buildOptions()
   * @param {MatcherView}                readonlyMatcher
   * @param {object} registry
   * @param {Function}              emit             – (chunk: string) => void
   * @param {number|string|undefined} space          – JSON.stringify space argument
   */
  constructor(parserOptions, builderOptions, readonlyMatcher, registry, emit, space) {
    super(parserOptions, builderOptions, readonlyMatcher, registry);

    this.tagsStack = [];

    this.parserOptions = parserOptions;
    this.builderOptions = builderOptions;
    this.groupBy = this.parserOptions.attributes.groupBy || "attributes";
    this._emit = emit;
    this._space = space;
    this._entryCount = 0;   // how many top-level entries have been emitted so far
    this._streamClosed = false;

    // currentNode starts as null — the first addElement() creates the root entry.
    // We don't need a synthetic root node because we emit each top-level entry
    // immediately on closeElement() when tagsStack is empty.
    this.currentNode = null;
    this.attributes = {};
    this._pendingStopNode = false;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Emit a fully-closed top-level entry to the stream.
   * Handles the JSON array framing:  "[" before the first entry,
   * "," as a separator between subsequent entries.
   * The closing "]" is written in getOutput().
   */
  _emitEntry(entry) {
    if (this._streamClosed) return;

    const json = JSON.stringify(entry, null, this._space);

    if (this._entryCount === 0) {
      // Open the JSON array with the first element
      this._emit('[\n' + json);
    } else {
      // Subsequent elements are comma-separated
      this._emit(',\n' + json);
    }

    this._entryCount++;
  }

  // -------------------------------------------------------------------------
  // BaseOutputBuilder interface
  // -------------------------------------------------------------------------

  addElement(tag) {
    if (this.currentNode !== null) {
      // We are already inside a top-level element — this is a nested open tag.
      // Migrate any pending text into the children array (mixed-content case).
      if (this.currentNode.text !== undefined) {
        this.currentNode.children.unshift({
          [this.parserOptions.nameFor.text]: this.currentNode.text,
        });
        delete this.currentNode.text;
      }

      this.tagsStack.push(this.currentNode);
    }
    // else: tagsStack is empty and currentNode is null → this is a new top-level element.

    const node = new Node(tag.name, this.groupBy);

    if (this.attributes && Object.keys(this.attributes).length > 0) {
      node[this.groupBy] = { ...this.attributes };
    }
    this.attributes = {};
    this.currentNode = node;
  }

  closeElement() {
    const node = this.currentNode;

    this._pendingStopNode = false;

    if (this.builderOptions.onClose !== undefined) {
      const resultTag = this.builderOptions.onClose(node, this.matcher);
      if (resultTag) {
        // Caller suppressed this entry; restore parent or null
        this.currentNode = this.tagsStack.pop() ?? null;
        return;
      }
    }

    // Build the entry object — same shape as SequentialBuilder
    const entry = { [node.tagname]: node.children };

    if (node[this.groupBy] && Object.keys(node[this.groupBy]).length > 0) {
      entry[this.groupBy] = node[this.groupBy];
    }

    if (node.text !== undefined) {
      entry.text = node.text;
    }

    if (this.tagsStack.length === 0) {
      // ── Top-level element just closed ────────────────────────────────────
      // Emit immediately; do NOT keep a reference (memory freed here).
      this._emitEntry(entry);
      this.currentNode = null;
    } else {
      // ── Nested element closed ─────────────────────────────────────────────
      // Attach to the parent's children array and pop the stack.
      this.currentNode = this.tagsStack.pop();
      this.currentNode.children.push(entry);
    }
  }

  addValue(text) {
    if (this.currentNode === null) return; // text outside any tag — ignore

    const hasElementChildren = this.currentNode.children?.some(
      (c) => !Object.prototype.hasOwnProperty.call(c, this.parserOptions.nameFor.text)
    );

    const context = new Context(
      this.currentNode.tagname,
      this.matcher,
      !hasElementChildren,
      false
    );

    const parsedValue = this._pendingStopNode ? text : this.tagsPipeline.run(text, context);

    if (hasElementChildren || this.builderOptions.textInChild) {
      this.currentNode.children.push({
        [this.parserOptions.nameFor.text]: parsedValue,
      });
    } else {
      this.currentNode.text = parsedValue;
    }
  }

  addInstruction(name) {
    if (this.currentNode === null) {
      // PI at document level — emit immediately as a standalone entry
      const node = new Node(name, this.groupBy);
      if (this.attributes && Object.keys(this.attributes).length > 0) {
        node[this.groupBy] = { ...this.attributes };
      }
      const entry = { [node.tagname]: node.children };
      if (node[this.groupBy] && Object.keys(node[this.groupBy]).length > 0) {
        entry[this.groupBy] = node[this.groupBy];
      }
      this.attributes = {};
      this._emitEntry(entry);
      return;
    }

    // PI inside an element — same as SequentialBuilder
    const node = new Node(name, this.groupBy);
    if (this.attributes && Object.keys(this.attributes).length > 0) {
      node[this.groupBy] = { ...this.attributes };
    }
    const entry = { [node.tagname]: node.children };
    if (node[this.groupBy] && Object.keys(node[this.groupBy]).length > 0) {
      entry[this.groupBy] = node[this.groupBy];
    }
    this.currentNode.children.push(entry);
    this.attributes = {};
  }

  addComment(text) {
    if (this.parserOptions.skip.comment) return;
    if (!this.parserOptions.nameFor.comment) return;
    if (this.currentNode === null) return; // comment outside any tag

    this.currentNode.children.push({
      [this.parserOptions.nameFor.comment]: text,
    });
  }

  addLiteral(text) {
    if (this.parserOptions.skip.cdata) return;

    if (this.parserOptions.nameFor.cdata) {
      if (this.currentNode === null) return;
      this.currentNode.children.push({
        [this.parserOptions.nameFor.cdata]: text,
      });
    } else {
      this.addValue(text || '');
    }
  }

  /**
   * Called after the full parse is complete.
   *
   * Closes the JSON array that was opened by the first _emitEntry() call.
   * If no entries were emitted at all (empty document), emits an empty array.
   *
   * Returns null — the output lives in the stream, not in memory.
   */
  getOutput() {
    if (this._streamClosed) return null;
    this._streamClosed = true;

    if (this._entryCount === 0) {
      this._emit('[]');
    } else {
      this._emit('\n]');
    }

    return null;
  }

  /**
   * onExit — called by the parser when exitIf returns true.
   *
   * The parser has already closed all open tags before calling this, so
   * all pending entries have already been emitted via closeElement().
   * We just need to close the JSON array, same as getOutput().
   *
   * @param {object} exitInfo
   */
  onExit(exitInfo) { // eslint-disable-line no-unused-vars
    this.getOutput();
  }
}

// ---------------------------------------------------------------------------

class Node {
  constructor(tagname, groupBy) {
    this.tagname = tagname;
    this.children = [];
    this[groupBy] = {};
  }
}