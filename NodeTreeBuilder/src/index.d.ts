export interface SkipOptions {
  /** Skip XML declaration `<?xml ... ?>` from output. Default: false */
  declaration?: boolean;
  /** Skip processing instructions (other than declaration) from output. Default: false */
  pi?: boolean;
  /**
   * Skip all attributes from output. When true (default), the `attributes`
   * property on every node is an empty object `{}`.
   * Set to false to populate attributes.
   * Default: true
   */
  attributes?: boolean;
  /** Exclude CDATA sections entirely from output. Default: false */
  cdata?: boolean;
  /** Exclude comments entirely from output. Default: false */
  comment?: boolean;
  /**
   * Strip namespace prefixes from tag and attribute names.
   * E.g. `ns:tag` → `tag`, `xmlns:*` attributes are dropped.
   * Default: false
   */
  nsPrefix?: boolean;
  /** (future) Tag-level filtering — not yet implemented. Default: false */
  tags?: boolean;
}

export interface NameForOptions {
  /**
   * Property name for inline text nodes in mixed content
   * (i.e. text that appears alongside child elements in the same parent).
   * These appear as `{ [text]: value }` entries in the `child` array.
   * Default: '#text'
   */
  text?: string;
  /**
   * Property name for CDATA sections.
   * Empty string (default) merges CDATA content into the node's `text` value.
   */
  cdata?: string;
  /**
   * Property name for XML comments.
   * Empty string (default) omits comments from output.
   * Set e.g. '#comment' to capture them.
   */
  comment?: string;
}

export interface AttributeOptions {
  /** Allow boolean (valueless) attributes — treated as `true`. Default: false */
  booleanType?: boolean;
  /**
   * Property name under which all attributes are grouped on each node.
   * The `attributes` property is always present (empty `{}` when no attributes
   * or when `skip.attributes` is true).
   * Default: 'attributes'
   */
  groupBy?: string;
  /** Prefix prepended to attribute names in output. Default: '@_' */
  prefix?: string;
  /** Suffix appended to attribute names in output. Default: '' */
  suffix?: string;
  /**
   * Value parser chain for attribute values.
   * Built-in names: 'entity', 'number', 'boolean', 'trim', 'currency'.
   * Default: ['entity', 'number', 'boolean']
   */
  valueParsers?: Array<string | ValueParser>;
}

export interface TagOptions {
  /**
   * Value parser chain for tag text content.
   * Built-in names: 'entity', 'boolean', 'number', 'trim', 'currency'.
   * Default: ['entity', 'boolean', 'number']
   * Add 'trim' to strip leading/trailing whitespace (not done by default).
   */
  valueParsers?: Array<string | ValueParser>;
}

export interface FactoryOptions {
  /** Fine-grained control over which node types appear in output */
  skip?: SkipOptions;

  /** Property names used for special nodes in output */
  nameFor?: NameForOptions;

  /** Attribute parsing and representation options */
  attributes?: AttributeOptions;

  /** Tag parsing options including stop nodes and value parser chain */
  tags?: TagOptions;
}

/**
 * A parsed XML node as produced by NodeTreeBuilder.
 *
 * - `tagname`    — element name
 * - `child`      — ordered array of child nodes; empty for leaf nodes
 * - `attributes` — always present; populated when `skip.attributes` is false
 * - `text`       — only present on leaf nodes (no child elements); holds the
 *                  parsed text value (may be string, number, or boolean
 *                  depending on the active value-parser chain)
 *
 * In mixed content (text interleaved with child elements), inline text runs
 * appear in `child` as `{ [nameFor.inlineText]: value }` objects (default
 * key is `":text"`). The parent node has no `text` property in that case.
 */
export interface XmlNode {
  tagname: string;
  child: Array<XmlNode | Record<string, any>>;
  attributes: Record<string, any>;
  text?: string | number | boolean;
  [key: string]: any;
}

export interface NodeTreeBuilderInstance {
  addElement(tag: { name: string }, matcher: any): void;
  closeElement(matcher: any): void;
  addValue(text: string, matcher: any): void;
  addAttribute(name: string, value: any): void;
  addComment(text: string): void;
  addLiteral(text: string): void;
  addDeclaration(): void;
  addInstruction(name: string): void;
  /**
   * Called by the XML parser after the DOCTYPE block is read.
   * Implementations forward entities to any registered value parser
   * that implements addInputEntities().
   */
  addInputEntities(entities: object): void;
  getOutput(): XmlNode | XmlNode[];
  registeredValParsers: Record<string, ValueParser>;
  /**
   * Optional hook called by the parser when a stop node is fully collected.
   * Delegates to the `options.onStopNode` callback when supplied.
   */
  onStopNode?(
    tagDetail: { name: string; line: number; col: number; index: number },
    rawContent: string,
    matcher: any,
  ): void;
}

/**
 * A value parser transforms a value in the parsing chain.
 * Receives the current value and an optional context object.
 */
export interface ValueParser {
  /**
   * @param val     Current value (string initially; may already be typed if earlier parsers ran)
   * @param context { tagName, isAttribute, attrName? }
   */
  parse(val: any, context?: { tagName: string; isAttribute: boolean; attrName?: string }): any;
}

export class NodeTreeBuilderFactory {
  constructor(options?: Partial<FactoryOptions>);
  getInstance(factoryOptions: FactoryOptions): NodeTreeBuilderInstance;
  registerValueParser(name: string, parser: ValueParser): void;
}