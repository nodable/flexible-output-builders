import { buildOptions } from './ParserOptionsBuilder.js';
import { BaseOutputBuilder, BaseOutputBuilderFactory, commonValueParsers, ElementType } from '@nodable/base-output-builder';
import { Expression } from 'path-expression-matcher';

export default class CompactBuilderFactory extends BaseOutputBuilderFactory {
  constructor(builderOptions) {
    super()
    this.options = buildOptions(builderOptions);

    // Pre-compile any string expressions in alwaysArray to Expression objects once
    if (this.options.alwaysArray) {
      this.options.alwaysArray = this.options.alwaysArray.map(entry =>
        typeof entry === 'string' ? new Expression(entry) : entry
      );
    }
  }

  // registerValueParser(name, parserInstance) {
  //   //This would replace the default value parser with the user provided value parser
  //   this.commonValParsers[name] = parserInstance;
  // }

  getInstance(parserOptions, readonlyMatcher) {
    this.resetValueParsers();
    const valParsers = { ...this.commonValParsers };
    return new CompactBuilder(parserOptions, this.options, valParsers, readonlyMatcher);
  }
}

export class CompactBuilder extends BaseOutputBuilder {

  constructor(parserOptions, builderOptions, registeredValParsers, readonlyMatcher) {
    super(readonlyMatcher);
    this.tagsStack = [];

    this.options = {
      ...builderOptions,
      ...parserOptions,
      skip: { ...builderOptions.skip, ...parserOptions.skip },
      nameFor: { ...builderOptions.nameFor, ...parserOptions.nameFor },
      tags: { ...builderOptions.tags, ...parserOptions.tags },
      attributes: { ...builderOptions.attributes, ...parserOptions.attributes },
      textJoint: builderOptions.textJoint || "", // when text for a tag is combined from multiple text nodes

      /**
       * Function to determine if a tag should be forced into an array.
       * Called with (matcher, isLeafNode) where:
       * - matcher: ReadOnlyMatcher - path matcher for current tag
       * - isLeafNode: boolean|null - null when not yet determinable
       * Returns: boolean - true to force array, false to veto, undefined to abstain
       */
      forceArray: builderOptions?.forceArray || null,

      /**
       * Array of strings (tag names) or Expression objects.
       * Any match votes true; no match abstains (does not veto).
       * Combined with forceArray using equal-priority voting:
       * - Either explicit false → false (veto wins)
       * - Any true, none false → true
       * - All abstain → false (default)
       */
      alwaysArray: builderOptions?.alwaysArray || [],

      /**
       * Boolean flag that forces creation of a text node for every tag.
       * When true, a text node is always created under nameFor.text even if
       * the tag has no other children or attributes.
       * Default: false (text node created only when tag has attributes or children)
       */
      forceTextNode: builderOptions?.forceTextNode ?? false,
    };

    this.registeredValParsers = registeredValParsers;

    this.root = {};
    this.parent = this.root;
    this.tagName = this._rootName;
    this.value = {};
    this.textValue = "";
    this.attributes = {};
    this.hasAttributes = false;
  }

  /**
   * Builds the initial value object from the current attributes and sets
   * `this.hasAttributes` accordingly. Returns "" when there are no attributes.
   *
   * Centralises the duplicated attribute-grouping logic so that callers
   * (addElement, addInstruction) stay concise and closeElement() can rely on
   * the flag instead of re-inspecting value keys or prefixes.
   *
   * @returns {object|string} Attribute object, or "" when no attributes exist.
   */
  _buildAttributeValue() {
    if (isEmpty(this.attributes)) {
      this.hasAttributes = false;
      return "";
    }
    this.hasAttributes = true;
    if (this.options.attributes.groupBy) {
      return { [this.options.attributes.groupBy]: this.attributes };
    }
    return this.attributes; // no spread needed — this.attributes is reassigned to {} right after
  }

  addElement(tag) {
    const value = this._buildAttributeValue();

    // Push current tag's value-tree state so closeElement() can restore it.
    // tagName is included so the builder is self-contained — callers do not
    // need to pass the name back in on close.
    this.tagsStack.push([this.tagName, this.textValue, this.value, this.hasAttributes]);
    this.tagName = tag.name;
    this.value = value;
    this.textValue = "";
    this.attributes = {};
  }

  /**
   * Called when a stop node is fully collected, before `addValue`.
   * Fires the user-supplied `onStopNode` callback if one is configured.
   *
   * @param {TagDetail} tagDetail  - Name, line, col, index of the stop node.
   * @param {string}    rawContent - Raw unparsed content between the tags.
   */
  onStopNode(tagDetail, rawContent) {
    if (typeof this.options.onStopNode === 'function') {
      this.options.onStopNode(tagDetail, rawContent, this.matcher);
    }
  }

  /**
   * Combines votes from `alwaysArray` and `forceArray` with equal priority.
   *
   * Voting rules:
   *   - `alwaysArray`: true if any entry matches, undefined (abstain) if none match.
   *     It never votes false — no match is not a veto.
   *   - `forceArray`: returns true / false / undefined directly.
   *
   * Resolution:
   *   - Any voter returns explicit false  → false  (veto wins)
   *   - Any voter returns true, none false → true
   *   - All abstain (undefined)            → false  (default)
   *
   * @param {boolean|null} isLeafNode
   * @returns {boolean}
   */
  _resolveForceArray(isLeafNode) {
    // --- alwaysArray vote ---
    let alwaysVote; // undefined = abstain
    const alwaysArray = this.options.alwaysArray;
    const matched = alwaysArray.some(entry => this.matcher.matches(entry));
    if (matched) alwaysVote = true;
    // no match → alwaysVote stays undefined (abstain, not false)

    // --- forceArray vote ---
    let forceVote; // undefined = abstain
    if (typeof this.options.forceArray === 'function') {
      const result = this.options.forceArray(this.matcher, isLeafNode);
      if (result === true) forceVote = true;
      else if (result === false) forceVote = false;
      // anything else (undefined, null, …) → abstain
    }

    // --- resolution ---
    if (alwaysVote === false || forceVote === false) return false; // veto
    else if (alwaysVote === true || forceVote === true) return true;  // at least one yes
    return false; // all abstain → default
  }

  closeElement() {
    const tagName = this.tagName;
    let value = this.value; // contains attributes if not skipped
    const textValue = this.textValue;
    const hasAttributes = this.hasAttributes;

    // A tag is a leaf node if it has no child elements.
    // It can have attributes and still be a leaf node.
    // hasAttributes is tracked explicitly by _buildAttributeValue() so we never
    // need to reverse-engineer this from key names, prefixes, or groupBy keys.
    const isLeafNode = typeof value !== "object"  // plain string value (no attrs, no children)
      || Array.isArray(value)                      // unexpected array → treat as leaf
      || isEmpty(value)                            // no attributes, no children
      || hasAttributes;                            // only attributes present, no child elements yet

    const context = {
      elementName: tagName,
      elementValue: textValue,
      elementType: ElementType.ELEMENT,
      matcher: this.matcher,
      isLeafNode: isLeafNode,
    };

    if (isLeafNode) {
      const parsedText = this.parseValue(textValue, this.options.tags.valueParsers, context);

      if (hasAttributes) {
        // Attributes are present — value is already an object.
        // Only write the text node when there is actual text content; an empty
        // parsedText alongside attributes would produce a spurious #text:"" key.
        // forceTextNode overrides this and writes the node even when empty.
        if (parsedText !== "" && parsedText !== null && parsedText !== undefined) {
          value[this.options.nameFor.text] = parsedText;
        } else if (this.options.forceTextNode) {
          value[this.options.nameFor.text] = parsedText;
        }
      } else if (this.options.forceTextNode) {
        // No attributes — wrap in an object so the shape is always consistent
        value = { [this.options.nameFor.text]: parsedText };
      } else {
        // No attributes, no forceTextNode — use the plain parsed value
        value = parsedText;
      }
    } else if (textValue.length > 0) {
      // Non-leaf node with actual text content sitting between child elements
      const parsedText = this.parseValue(textValue, this.options.tags.valueParsers, context);
      value[this.options.nameFor.text] = parsedText;
    } else if (textValue.length > 0 || this.options.forceTextNode) {
      const parsedText = this.parseValue(textValue, this.options.tags.valueParsers, context);
      value[this.options.nameFor.text] = parsedText;
    }

    let resultTag = { tagName, value };

    if (this.options.onTagClose !== undefined) {
      resultTag = this.options.onTagClose(tagName, value, textValue, this.matcher);
      if (!resultTag) return;
    }

    const arr = this.tagsStack.pop();
    let parentTag = arr[2];

    // Check if this tag should be forced into an array
    const shouldForceArray = this._resolveForceArray(isLeafNode);

    parentTag = this._addChildTo(resultTag.tagName, resultTag.value, parentTag, shouldForceArray);

    this.tagName = arr[0];
    this.textValue = arr[1];
    this.value = parentTag;
    this.hasAttributes = arr[3]; // restore parent tag's flag
  }

  _addChild(key, val) {
    if (typeof this.value === "string") {
      this.value = { [this.options.nameFor.text]: this.value };
    }
    this._addChildTo(key, val, this.value, false);
    this.attributes = {};
  }

  _addChildTo(key, val, node, forceArray) {
    if (typeof node === 'string') node = {};

    if (!Object.prototype.hasOwnProperty.call(node, key)) {
      // First occurrence of this key
      if (forceArray) {
        node[key] = [val];
      } else {
        node[key] = val;
      }
    } else {
      // Key already exists
      if (!Array.isArray(node[key])) {
        node[key] = [node[key]];
      }
      node[key].push(val);
    }
    return node;
  }

  addValue(text) {
    if (this.textValue.length > 0) this.textValue += this.options.textJoint + text;
    else this.textValue = text;
  }

  /**
   * Called by the parser when `exitIf` returns true for the current tag.
   * Receives a snapshot of the parser state at the moment of exit, after
   * all open tags have been cleanly closed by the parser.
   *
   * Override in subclasses to record the exit position or annotate output.
   *
   * @param {object} exitInfo
   * @param {object} exitInfo.tagDetail   - `{ name, line, col, index }` of the
   *                                        tag that triggered the exit.
   * @param {object} exitInfo.matcher     - Read-only matcher positioned at
   *                                        that tag at the moment exitIf fired.
   * @param {number} exitInfo.depth       - Nesting depth at exit (0 = root children).
   */
  onExit(exitInfo) {
    // Base implementation: attach exit metadata to the output root so callers
    // can tell the parse was intentionally truncated and where it stopped.
    // Stored under __exitInfo to avoid colliding with any tag-derived key.
    // Subclasses may override to suppress, transform, or log this information.
    // if (this.value && typeof this.value === 'object') {
    //   Object.defineProperty(this.value, '__exitInfo', {
    //     value: {
    //       tag: exitInfo.tagDetail.name,
    //       line: exitInfo.tagDetail.line,
    //       col: exitInfo.tagDetail.col,
    //       index: exitInfo.tagDetail.index,
    //       depth: exitInfo.depth,
    //     },
    //     enumerable: false,   // invisible to JSON.stringify and for-in
    //     configurable: true,
    //     writable: true,
    //   });
    // }

    //Do nothing
  }

  addInstruction(name) {
    const value = this._buildAttributeValue();
    this._addChild(name, value);
    this.attributes = {};
  }

  getOutput() {
    return this.value;
  }
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

// export { CompactBuilder as CompactObjBuilder };