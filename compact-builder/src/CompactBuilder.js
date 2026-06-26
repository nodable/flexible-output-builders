import { buildOptions } from './ParserOptionsBuilder.js';
import { BaseOutputBuilder, BaseOutputBuilderFactory, Context } from '@nodable/base-output-builder';
import { MatcherView } from 'path-expression-matcher';


export default class CompactBuilderFactory extends BaseOutputBuilderFactory {
  constructor(builderOptions = {}) {
    super();
    this.builderOptions = buildOptions(builderOptions);
  }

  getInstance(parserOptions, readonlyMatcher) {
    return new CompactBuilder(
      parserOptions,
      this.builderOptions,
      readonlyMatcher,
      this.registry
    );
  }
}

export class CompactBuilder extends BaseOutputBuilder {

  /**
   * @param {object}                parserOptions
   * @param {object}                builderOptions
   * @param {MatcherView} readonlyMatcher
   * @param {object}                registry
   */
  constructor(parserOptions, builderOptions, readonlyMatcher, registry) {
    super(parserOptions, builderOptions, readonlyMatcher, registry);
    this.parserOptions = parserOptions;
    this.builderOptions = builderOptions;
    this.tagsStack = [];
    this.root = {};
    this.parent = this.root;
    this.tagName = this._rootName;
    this.value = {};
    this.textValue = "";
    this.attributes = {};
    this.hasAttributes = false;
  }

  /**
   * Builds the initial value object from current attributes.
   * Returns "" when there are no attributes.
   */
  _buildAttributeValue() {
    if (isEmpty(this.attributes)) {
      this.hasAttributes = false;
      return "";
    }
    this.hasAttributes = true;
    if (this.parserOptions.attributes.groupBy) {
      return { [this.parserOptions.attributes.groupBy]: this.attributes };
    }
    return this.attributes;
  }

  addElement(tag) {
    const value = this._buildAttributeValue();
    this.tagsStack.push([this.tagName, this.textValue, this.value, this.hasAttributes]);
    this.tagName = tag.name;
    this.value = value;
    this.textValue = "";
    this.attributes = {};
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
    const matched = this.builderOptions._alwaysArraySet.matchesAny(this.matcher);
    if (matched) alwaysVote = true;
    // no match → alwaysVote stays undefined (abstain, not false)

    // --- forceArray vote ---
    let forceVote; // undefined = abstain
    if (typeof this.builderOptions.forceArray === 'function') {
      const result = this.builderOptions.forceArray(this.matcher, isLeafNode);
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

    const context = new Context(
      tagName,
      this.matcher,
      isLeafNode,
      false,
    );

    if (isLeafNode) {
      const parsedText = this._pendingStopNode ? textValue : this.tagsPipeline.run(textValue, context);

      if (hasAttributes) {
        // Attributes are present — value is already an object.
        // Only write the text node when there is actual text content; an empty
        // parsedText alongside attributes would produce a spurious #text:"" key.
        // forceTextNode overrides this and writes the node even when empty.
        if (parsedText !== "" && parsedText !== null && parsedText !== undefined) {
          value[this.parserOptions.nameFor.text] = parsedText;
        } else if (this.builderOptions.forceTextNode) {
          value[this.parserOptions.nameFor.text] = parsedText;
        }
      } else if (this.builderOptions.forceTextNode) {
        // No attributes — wrap in an object so the shape is always consistent
        value = { [this.parserOptions.nameFor.text]: parsedText };
      } else {
        // No attributes, no forceTextNode — use the plain parsed value
        value = parsedText;
      }
    } else if (textValue.length > 0 || this.builderOptions.forceTextNode) {
      // Non-leaf node with actual text content sitting between child elements
      // mixed content: element has both child tags and text
      const parsedText = this._pendingStopNode ? textValue : this.tagsPipeline.run(textValue, context);
      value[this.parserOptions.nameFor.text] = parsedText;
    }

    let resultTag = { tagName, value };

    // if (this.parserOptions.onTagClose !== undefined) {
    //   resultTag = this.parserOptions.onTagClose(tagName, value, textValue, this.matcher);
    //   if (!resultTag) return;
    // }

    const arr = this.tagsStack.pop();
    let parentTag = arr[2];

    // Check if this tag should be forced into an array
    const shouldForceArray = this._resolveForceArray(isLeafNode);

    parentTag = this._addChildTo(resultTag.tagName, resultTag.value, parentTag, shouldForceArray);

    this.tagName = arr[0];
    this.textValue = arr[1];
    this.value = parentTag;
    this.hasAttributes = arr[3]; // restore parent tag's flag
    this._pendingStopNode = false;
  }

  _addChild(key, val) {
    if (typeof this.value === "string") {
      this.value = { [this.parserOptions.nameFor.text]: this.value };
    }
    this._addChildTo(key, val, this.value, false);
    this.attributes = {};
  }

  _addChildTo(key, val, node, forceArray) {
    if (typeof node === 'string') node = {};

    if (!Object.prototype.hasOwnProperty.call(node, key)) {
      node[key] = forceArray ? [val] : val;
    } else {
      if (!Array.isArray(node[key])) node[key] = [node[key]];
      node[key].push(val);
    }
    return node;
  }

  addValue(text) {
    if (this.textValue.length > 0) this.textValue += `${this.builderOptions.textJoint}${text}`;
    else this.textValue = text;
  }

  addInstruction(name) {
    const value = this._buildAttributeValue();
    this._addChild(name, value);
    this.attributes = {};
  }

  onExit(exitInfo) { }

  getOutput() {
    return this.value;
  }
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

