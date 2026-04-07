import { buildOptions } from './ParserOptionsBuilder.js';
import { BaseOutputBuilder, BaseOutputBuilderFactory, ElementType } from '@solothought/base-output-builder';
import { Expression } from 'path-expression-matcher';

/**
 * Stack frame structure (one per open tag):
 *
 * {
 *   tagName:      string,   // this tag's name (needed when closing, to tell parent the key)
 *   attributes:   object,   // accumulated attributes, cleared after closeElement flushes them
 *   textValue:    string,   // accumulated text content
 *
 *   // Parent-side tracking (what THIS frame knows about its own children):
 *   firstChild:   null | { key: string, chunk: string },
 *                           // the ONE buffered child not yet emitted.
 *                           // null = no children seen yet.
 *                           // Once a second child with same key arrives → promote to array.
 *   openEmitted:  boolean,  // true once we've written '{' for this object to the stream
 *   childCount:   number,   // how many children have been fully flushed to the stream
 *                           // (used to decide whether to prepend ',' before next child)
 *   arrayKeys:    Set,      // keys that have been promoted to arrays already
 * }
 *
 * Memory discipline:
 *   - attributes  → nulled out after being serialized in closeElement()
 *   - firstChild  → nulled out after being flushed to stream
 *   - textValue   → cleared after use
 */

export default class CompactStreamBuilderFactory extends BaseOutputBuilderFactory {
  constructor(builderOptions) {
    super();
    this.options = buildOptions(builderOptions);

    // Pre-compile string expressions in alwaysArray once
    if (this.options.alwaysArray) {
      this.options.alwaysArray = this.options.alwaysArray.map(entry =>
        typeof entry === 'string' ? new Expression(entry) : entry
      );
    }
  }

  getInstance(parserOptions, readonlyMatcher) {
    const valParsers = { ...this.commonValParsers };
    return new CompactStreamBuilder(parserOptions, this.options, valParsers, readonlyMatcher);
  }
}

export class CompactStreamBuilder extends BaseOutputBuilder {

  constructor(parserOptions, builderOptions, registeredValParsers, readonlyMatcher) {
    super(readonlyMatcher);
    const stream = builderOptions?.stream;

    this.options = {
      ...builderOptions,
      ...parserOptions,
      skip: { ...parserOptions.skip, ...builderOptions.skip },
      nameFor: { ...parserOptions.nameFor, ...builderOptions.nameFor },
      tags: { ...parserOptions.tags, ...builderOptions.tags },
      attributes: { ...parserOptions.attributes, ...builderOptions.attributes },
      textJoint: builderOptions.textJoint || "",
      forceArray: builderOptions?.forceArray || null,
      alwaysArray: builderOptions?.alwaysArray || [],
      forceTextNode: builderOptions?.forceTextNode ?? false,

      // onChunk: function(text) — called every time we flush a piece of JSON
      // Either supply onChunk directly, or supply stream (Node.js Writable).
      // If stream is supplied we wrap it into onChunk automatically.
      onChunk: stream
        ? (text) => stream.write(text)
        : (builderOptions?.onChunk || null),
    };

    if (!this.options.onChunk) {
      throw new Error('CompactStreamBuilder requires either onChunk or stream option.');
    }

    this.registeredValParsers = registeredValParsers;

    // Stack of frame objects (see structure above).
    // We start with a synthetic root frame so the very first real tag
    // has a parent to attach to, exactly like CompactBuilder uses `this.root`.
    this.tagsStack = [];
    this._pushFrame('^'); // root sentinel

    // _pendingAttrs accumulates addAttribute() calls before we know whether
    // they belong to a regular element or a PI/declaration.
    // addElement() moves them onto the new frame;
    // addInstruction()/addDeclaration() consumes and clears them for PIs.
    this._pendingAttrs = {};
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  /** Push a new stack frame for a tag that is opening. */
  _pushFrame(tagName) {
    this.tagsStack.push({
      tagName,
      attributes: {},
      textValue: '',
      firstChild: null,   // { key, chunk } — buffered, not yet emitted
      openEmitted: false,
      childCount: 0,
      arrayKeys: new Set(),
    });
  }

  /** The frame currently being built (top of stack). */
  _top() {
    return this.tagsStack[this.tagsStack.length - 1];
  }

  /** The parent frame (one below top). */
  _parent() {
    return this.tagsStack[this.tagsStack.length - 2];
  }

  /** Emit a string chunk to the output. */
  _emit(text) {
    this.options.onChunk(text);
  }

  /**
   * FIX (sentinel never flushes): called after _receiveChild() whenever the
   * receiving frame is the root sentinel (tagsStack.length === 1 after the pop).
   * The sentinel has no closing tag, so we must proactively flush whatever it
   * buffered and close any open JSON structures.
   */
  _flushSentinel() {
    const sentinel = this.tagsStack[0];
    if (!sentinel) return;

    // Flush any buffered single child.
    if (sentinel.firstChild !== null) {
      const { key, chunk } = sentinel.firstChild;
      this._flushSingleChild(sentinel, key, chunk);
      sentinel.firstChild = null;
    }

    // Close any open array (e.g. repeated top-level elements).
    if (sentinel.arrayKeys.size > 0) {
      this._emit(']');
      sentinel.arrayKeys.clear();
    }

    // Close the wrapping object if one was opened.
    if (sentinel.openEmitted) {
      this._emit('}');
      sentinel.openEmitted = false;
    }
  }

  // ─── Public interface (called by XML parser) ─────────────────────────────────

  /**
   * Called when the parser closes a tag. This is where we serialize the tag's
   * value and hand it to the parent frame, either flushing or buffering.
   *
   * Steps:
   *   1. Pop this frame off the stack.
   *   2. Serialize this tag's complete value into a JSON chunk string.
   *   3. Hand the chunk to the parent frame via _receiveChild().
   */
  closeElement() {
    const frame = this.tagsStack.pop();
    const tagName = frame.tagName;
    const attrs = frame.attributes;
    const textValue = frame.textValue;
    const hasAttrs = Object.keys(attrs).length > 0;
    const hasCdata = frame._cdataValue !== undefined;

    // ── Determine the context for value parsers ──────────────────────────────
    // isLeafNode: true if this tag has no child elements
    const isLeafNode = !frame.openEmitted && frame.firstChild === null;

    const context = {
      elementName: tagName,
      elementValue: textValue,
      elementType: ElementType.ELEMENT,
      matcher: this.matcher,
      isLeafNode,
    };

    // ── Serialize this tag's value into a JSON string chunk ──────────────────
    let chunk;

    if (isLeafNode) {
      // No child elements — value is text (possibly with attributes and/or CDATA)
      const parsedText = this.parseValue(textValue, this.options.tags.valueParsers, context);

      if (hasAttrs || hasCdata) {
        // Has attributes and/or named CDATA → serialize as object.
        // _serializeObject will include the cdata field from frame._cdataValue.
        chunk = this._serializeObject(attrs, parsedText, frame);
      } else if (this.options.forceTextNode) {
        chunk = JSON.stringify({ [this.options.nameFor.text]: parsedText });
      } else {
        // Plain leaf — just the value
        chunk = JSON.stringify(parsedText);
      }
    } else {
      // Has child elements — the opening '{' was already emitted,
      // but we still have the firstChild buffer and possibly a trailing text node.
      // Flush whatever is still pending before we close.
      this._flushPendingChild(frame);

      if (textValue.length > 0 || this.options.forceTextNode) {
        const parsedText = this.parseValue(textValue, this.options.tags.valueParsers, context);
        const textKey = this.options.nameFor.text;
        const comma = frame.childCount > 0 ? ',' : '';
        this._emit(`${comma}${JSON.stringify(textKey)}:${JSON.stringify(parsedText)}`);
        frame.childCount++;
      }

      this._emit('}');
      // For non-leaf, chunk is null — we already emitted directly into the stream.
      // The parent only needs to know the key name to close arrays etc.
      chunk = null;
    }

    // Free memory — attributes and text no longer needed
    frame.attributes = null;
    frame.textValue = null;

    // ── Hand result to parent ────────────────────────────────────────────────
    if (this.tagsStack.length > 0) {
      this._receiveChild(tagName, chunk, frame.openEmitted);

      // FIX (sentinel never flushes): if the only remaining frame is the sentinel,
      // flush it immediately — it will never receive a closeElement() of its own.
      if (this.tagsStack.length === 1) {
        this._flushSentinel();
      }
    }
  }

  /**
   * Serialize an object with attributes (and optionally a text node) into JSON string.
   * Does NOT emit — just returns the string so the caller can buffer or emit it.
   */
  _serializeObject(attrs, parsedText, frame) {
    const parts = [];

    if (this.options.attributes.groupBy) {
      parts.push(`${JSON.stringify(this.options.attributes.groupBy)}:${JSON.stringify(attrs)}`);
    } else {
      for (const [k, v] of Object.entries(attrs)) {
        parts.push(`${JSON.stringify(k)}:${JSON.stringify(v)}`);
      }
    }

    if (parsedText !== '' && parsedText !== undefined && parsedText !== null) {
      parts.push(`${JSON.stringify(this.options.nameFor.text)}:${JSON.stringify(parsedText)}`);
    } else if (this.options.forceTextNode) {
      parts.push(`${JSON.stringify(this.options.nameFor.text)}:${JSON.stringify(parsedText)}`);
    }

    // Include CDATA that was collected via addLiteral() into the leaf object.
    if (frame._cdataValue !== undefined) {
      const cdataKey = this.options.nameFor.cdata;
      parts.push(`${JSON.stringify(cdataKey)}:${JSON.stringify(frame._cdataValue)}`);
      frame._cdataValue = undefined;
    }

    // Also include any buffered first child that was waiting (edge case: leaf check was wrong)
    if (frame.firstChild !== null) {
      const { key, chunk } = frame.firstChild;
      parts.push(`${JSON.stringify(key)}:${chunk}`);
      frame.firstChild = null;
    }

    return `{${parts.join(',')}}`;
  }

  /**
   * Called by a closing child to register itself with its parent frame.
   *
   * Buffering / array promotion logic:
   *
   *   Case A — parent has NO buffered child yet (firstChild === null):
   *     → Buffer this child as firstChild. Don't emit yet.
   *
   *   Case B — parent HAS a buffered child with a DIFFERENT key:
   *     → Flush the buffered child, then buffer this one.
   *       (They're different keys — no array needed for the old one.)
   *
   *   Case C — parent HAS a buffered child with the SAME key:
   *     → This key needs to become an array. Emit '[' + old chunk + ',' + new chunk.
   *       Mark key in arrayKeys. Clear firstChild.
   *
   *   Case D — key is already in arrayKeys (third+ sibling):
   *     → Just emit ',' + new chunk (array is already open).
   *
   * @param {string}       key          - Tag name (the JSON key)
   * @param {string|null}  chunk        - Serialized JSON value, or null if already emitted
   * @param {boolean}      alreadyEmitted - true when non-leaf (already emitted to stream)
   */
  _receiveChild(key, chunk, alreadyEmitted) {
    const parent = this._top();
    const shouldForceArray = this._resolveForceArray(parent);

    if (alreadyEmitted) {
      // Child already wrote itself to the stream (it was a non-leaf).
      // Parent's '{' must be open because we emitted the child's '{' which
      // required ensureParentOpen at that time. Just track childCount.
      // But first: close any open array for a different key if needed.
      if (parent.arrayKeys.size > 0 && !parent.arrayKeys.has(key)) {
        this._emit(']');
        parent.arrayKeys.clear();
      }
      parent.childCount++;
      return;
    }

    if (parent.arrayKeys.has(key)) {
      // Case D: already an open array for this key — just append
      this._emit(`,${chunk}`);
      parent.childCount++;
      return;
    }

    if (parent.firstChild === null) {
      if (shouldForceArray) {
        // We know it's an array — open it immediately
        this._ensureParentOpen(parent);
        const comma = parent.childCount > 0 ? ',' : '';
        this._emit(`${comma}${JSON.stringify(key)}:[${chunk}`);
        parent.arrayKeys.add(key);
        parent.childCount++;
      } else {
        // Case A: buffer and wait
        parent.firstChild = { key, chunk };
      }
      return;
    }

    const buffered = parent.firstChild;

    if (buffered.key !== key) {
      // Case B: different key — flush the buffered one, buffer the new one
      this._flushSingleChild(parent, buffered.key, buffered.chunk);
      parent.firstChild = null; // free memory
      parent.firstChild = { key, chunk };
    } else {
      // Case C: same key — promote to array
      this._ensureParentOpen(parent);
      const comma = parent.childCount > 0 ? ',' : '';
      this._emit(`${comma}${JSON.stringify(key)}:[${buffered.chunk},${chunk}`);
      parent.arrayKeys.add(key);
      parent.firstChild = null; // free memory
      parent.childCount++;
    }
  }

  /**
   * Flush the firstChild buffer unconditionally (called when parent is closing
   * or a different-keyed sibling arrived).
   */
  _flushPendingChild(frame) {
    if (frame.firstChild === null) return;
    const { key, chunk } = frame.firstChild;
    this._flushSingleChild(frame, key, chunk);
    frame.firstChild = null; // free memory
  }

  /**
   * Emit a single key:value pair into the parent's object stream.
   * Ensures the parent '{' is open and handles commas.
   */
  _flushSingleChild(parentFrame, key, chunk) {
    this._ensureParentOpen(parentFrame);

    // If there's an open array for a DIFFERENT key, close it first.
    // Only one key's array can be open at a time (we only buffer one child).
    if (parentFrame.arrayKeys.size > 0 && !parentFrame.arrayKeys.has(key)) {
      this._emit(']');
      parentFrame.arrayKeys.clear();
    }

    const comma = parentFrame.childCount > 0 ? ',' : '';
    this._emit(`${comma}${JSON.stringify(key)}:${chunk}`);
    parentFrame.childCount++;
  }

  /**
   * Emit the opening '{' for a parent frame if not already done.
   * Also closes any open arrays from prior keys if a new key is starting.
   */
  _ensureParentOpen(frame) {
    if (!frame.openEmitted) {
      this._emit('{');
      frame.openEmitted = true;
    }
  }

  /**
   * Resolve whether the current tag should be forced into an array,
   * using alwaysArray + forceArray voting (same logic as CompactBuilder).
   */
  _resolveForceArray(frame) {
    let alwaysVote;
    const matched = this.options.alwaysArray.some(entry => this.matcher.matches(entry));
    if (matched) alwaysVote = true;

    let forceVote;
    if (typeof this.options.forceArray === 'function') {
      const result = this.options.forceArray(this.matcher, null);
      if (result === true) forceVote = true;
      else if (result === false) forceVote = false;
    }

    if (alwaysVote === false || forceVote === false) return false;
    if (alwaysVote === true || forceVote === true) return true;
    return false;
  }

  addElement(tag) {
    this._pushFrame(tag.name);
    // Move any attrs that arrived before addElement() onto the new frame.
    // (Parser sends addAttribute calls before addElement for regular tags.)
    if (Object.keys(this._pendingAttrs).length > 0) {
      Object.assign(this._top().attributes, this._pendingAttrs);
      this._pendingAttrs = {};
    }
  }

  addValue(text) {
    const frame = this._top();
    if (frame.textValue.length > 0) frame.textValue += this.options.textJoint + text;
    else frame.textValue = text;
  }

  // All addAttribute() calls are staged in _pendingAttrs first.
  // addElement() moves them to the frame; addInstruction()/addDeclaration()
  // consumes them as PI attrs and clears them.
  addAttribute(name, value) {
    this._pendingAttrs[name] = value;
  }

  addComment(text) {
    if (this.options.skip.comment) return;
    const key = this.options.nameFor.comment;
    if (!key) return; // empty string means "omit comments"
    this._receiveChild(key, JSON.stringify(text), false);
    // Comments at top level: flush sentinel immediately.
    if (this.tagsStack.length === 1) this._flushSentinel();
  }

  addLiteral(text) {
    // CDATA section.
    if (this.options.skip.cdata) return;
    const key = this.options.nameFor.cdata;
    if (key) {
      // When the enclosing element has attributes we must stay on the leaf path
      // so that _serializeObject() can co-emit attrs + cdata + text together.
      // We do that by storing the cdata text in a dedicated slot on the frame
      // instead of routing through _receiveChild (which would mark us non-leaf).
      const frame = this._top();
      if (frame) {
        // Store separately; _serializeObject will pick it up.
        frame._cdataValue = (frame._cdataValue || '') + text;
        return;
      }
      // Fallback (no frame — shouldn't happen for well-formed XML)
      this._receiveChild(key, JSON.stringify(text), false);
    } else {
      this.addValue(text);
    }
  }

  addDeclaration() {
    // XML declaration <?xml ... ?> — discard attrs, nothing to emit.
    this._pendingAttrs = {};
  }

  addInstruction(name) {
    // Processing instruction e.g. <?php ... ?>
    if (this.options.skip.pi) { this._pendingAttrs = {}; return; }

    const attrs = this._pendingAttrs;
    const hasAttrs = Object.keys(attrs).length > 0;
    const chunk = hasAttrs ? JSON.stringify(attrs) : 'true';
    this._pendingAttrs = {}; // clear for next PI

    this._receiveChild(name, chunk, false);

    // PIs at top level: flush sentinel immediately so the output is written
    // before the next sibling (or end of document) causes the sentinel to lose it.
    if (this.tagsStack.length === 1) this._flushSentinel();
  }

  addInputEntities(entities) {
    // Forward to any registered value parser that supports it
    for (const parser of Object.values(this.registeredValParsers)) {
      if (typeof parser.addInputEntities === 'function') {
        parser.addInputEntities(entities);
      }
    }
  }

  onStopNode(tagDetail, rawContent) {
    if (typeof this.options.onStopNode === 'function') {
      this.options.onStopNode(tagDetail, rawContent, this.matcher);
    }
  }

  getOutput() {
    // Stream builder has no in-memory output — everything was written to the stream.
    return null;
  }
}