import { MatcherView } from 'path-expression-matcher';
import { Context, SharedContext, ValueParserPipeline } from './ValueParser.js';
import ValueParserRegistry from './ValueParserRegistry.js';

// Default parser chains.
const DEFAULT_TAG_PARSERS = ['ws', 'entity', 'boolean', 'number'];
const DEFAULT_ATTR_PARSERS = ['entity', 'boolean', 'number'];

export default class BaseOutputBuilder {

  /**
   * @param {object}              parserOptions
   * @param {object}              builderOptions
   * @param {MatcherView}         matcherView
   * @param {ValueParserRegistry} registry
   * @param {boolean}             resetPipelines
   */
  constructor(parserOptions, builderOptions, matcherView, registry, resetPipelines = true) {
    this.matcher = matcherView;
    this._rootName = "^";
    this.parserOptions = parserOptions;
    this.builderOptions = builderOptions;
    this.registry = registry;

    const tagChain = builderOptions?.tags?.valueParsers ?? DEFAULT_TAG_PARSERS;
    const attrChain = builderOptions?.attributes?.valueParsers ?? DEFAULT_ATTR_PARSERS;

    /**
     * Shared mutable context distributed to all value parsers.
     * `BaseOutputBuilder` is the sole writer; parsers are readers (or
     * co-writers for cross-parser communication).
     * @type {SharedContext|null}
     */
    this.sharedContext = new SharedContext();
    /**
     * Pipeline for tag text values.
     * Call `this.tagsPipeline.run(val, context)` from subclass
     * `closeElement()` implementations.
     * @type {ValueParserPipeline}
     */
    this.tagsPipeline = new ValueParserPipeline(tagChain, this.registry, this.sharedContext);
    /**
     * Pipeline for attribute values.
     * Call `this.attrsPipeline.run(val, context)` from subclass
     * `addAttribute()` implementations.
     * @type {ValueParserPipeline}
     */
    this.attrsPipeline = new ValueParserPipeline(attrChain, this.registry, this.sharedContext);

    if (resetPipelines) {
      this.tagsPipeline.resetAll();
      this.attrsPipeline.resetAll();
    }

    this._pendingStopNode = false;
  }

  /**
   * Add a parsed attribute to the current element.
   * Only called when skip.attributes is false.
   *
   * @param {string}  name    Processed attribute name (prefix stripped, sanitised)
   * @param {*}       value   Raw attribute value
   * @param {object}  matcher Read-only Matcher proxy from the parser
   */
  addAttribute(name, value, matcher) {
    // Capture XML version from the declaration tag and make it available to
    // value parsers (e.g. EntityParser) via SharedContext.
    if (name === "version" && this.tagName === this._rootName) {
      this.sharedContext?.set('xmlVersion', +value);
    }
    const prefixed = `${this.parserOptions.attributes.prefix}${name}${this.parserOptions.attributes.suffix}`;
    const context = new Context(name, matcher, true, true);// attributes are always leaf values
    this.attributes[prefixed] = this.attrsPipeline.run(value, context);

  }

  /** Hook for subclasses to append a named child node. */
  _addChild(key, val) { }

  /**
   * Add a comment node.
   * - Dropped entirely when skip.comment is true.
   * - Stored under nameFor.comment when set; '' = omit from output.
   */
  addComment(text) {
    if (this.parserOptions.skip.comment) return;
    if (this.parserOptions.nameFor.comment) {
      this._addChild(this.parserOptions.nameFor.comment, text);
    }
  }

  /**
   * Add a CDATA section.
   * - Dropped entirely when skip.cdata is true.
   * - Stored under nameFor.cdata when set; '' = merge into element text value.
   */
  addLiteral(text) {
    if (this.parserOptions.skip.cdata) return;
    if (this.parserOptions.nameFor.cdata) {
      this._addChild(this.parserOptions.nameFor.cdata, text);
    } else {
      this.addRawValue(text || "");
    }
  }

  /**
   * Add raw text directly to the current element's text value, bypassing the
   * value-parser chain. Used by addLiteral() when CDATA merges into element text.
   */
  addRawValue(text) {
    this.addValue(text);
  }

  /**
   * Receive DOCTYPE entities from the XML parser and store them in
   * SharedContext so that value parsers can access them on their first
   * `parse()` call.
   *
   * @param {object} entities — raw entity map from DocTypeReader
   */
  addInputEntities(entities) {
    this.sharedContext?.set('inputEntities', entities);
  }

  /**
   * Handle XML declaration (<?xml ... ?>).
   * Dropped when skip.declaration is true.
   */
  addDeclaration(name) {
    this.addInstruction(name);
  }

  /**
   * Handle a processing instruction.
   * Subclasses override; base is a no-op.
   */
  addInstruction(name) {
  }

  /**
 * Called when a stop node is fully collected, before `addValue`.
 *
 * @param {TagDetail}       tagDetail  - name, line, col, index of the stop node
 * @param {string}          rawContent - raw unparsed content between the tags
 */
  onStopNode(tagDetail, rawContent) {
    this._pendingStopNode = true;
    if (typeof this.parserOptions.onStopNode === 'function') {
      this.parserOptions.onStopNode(tagDetail, rawContent, this.matcher);
    }
  }

  /**
   * Called by the parser when `exitIf` returns true for the current tag.
   * Receives a snapshot of the parser state at the moment of exit, after
   * all open tags have been cleanly closed by the parser.
   *
   * Override in subclasses to record the exit position or annotate output.
   *
   * @param {object} exitInfo
   * @param {object} exitInfo.tagDetail  `{ name, line, col, index }` of the tag that triggered the exit
   * @param {object} exitInfo.matcher    Read-only matcher at the moment exitIf fired
   * @param {number} exitInfo.depth      Nesting depth at exit (0 = root children)
   */
  onExit(exitInfo) { }
}
