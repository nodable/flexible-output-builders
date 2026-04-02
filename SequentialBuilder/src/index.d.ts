export interface SkipOptions {
  /** Skip XML declaration `<?xml ... ?>` from output. Default: false */
  declaration?: boolean;
  /** Skip processing instructions (other than declaration) from output. Default: false */
  pi?: boolean;
  /**
   * Skip all attributes from output. When true (default), the `attributes`
   * property on every entry is an empty object `{}`.
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
   * These appear as `{ [text]: value }` entries in the children array.
   * Default: '#text'
   */
  text?: string;
  /**
   * Property name for CDATA sections.
   * When set, CDATA nodes appear as `{ [cdata]: value }` entries in the children array.
   * When unset (default), CDATA content is merged into the node's `text` value.
   */
  cdata?: string;
  /**
   * Property name for XML comments.
   * When unset (default), comments are omitted from output.
   * Set e.g. '#comment' to capture them as `{ '#comment': value }` entries.
   */
  comment?: string;
}

export interface AttributeOptions {
  /** Allow boolean (valueless) attributes — treated as `true`. Default: false */
  booleanType?: boolean;
  /**
   * Property name under which all attributes are grouped on each entry, as a
   * sibling alongside the tag-name key.
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

  /**
   * When true, text is always stored as a `{ [nameFor.text]: value }` child entry,
   * even on pure leaf nodes (no mixed content required).
   * Default: false — leaf text is stored as a `text` sibling property on the entry.
   */
  textInChild?: boolean;
}

/**
 * A parsed XML entry as produced by SequentialBuilder.
 *
 * Structure:
 *   {
 *     [tagName]: Array<SequentialEntry>,   // tag name directly points to children array
 *     [groupBy]?: Record<string, any>,     // attributes (sibling property; present only when non-empty)
 *     text?: any                           // only present on leaf nodes (no child element entries)
 *   }
 *
 * Leaf node (text only, no child elements):
 *   { child: [], text: "Hello" }           — wait, the key IS the tag name:
 *   { span: [], text: "Hello" }
 *
 * Empty tag:
 *   { br: [] }
 *
 * Tag with child elements:
 *   { div: [ ...childEntries ] }
 *
 * Tag with attributes:
 *   { item: [], attributes: { "@_id": 1 }, text: "val" }
 *
 * Mixed content (text interleaved with child elements):
 *   Inline text runs appear as `{ [nameFor.text]: value }` entries inside the array.
 *   The entry has no `text` property in that case.
 *
 * The overall `getOutput()` returns an array — always — even for a single root element.
 */
export type SequentialEntry = Record<string, any>;

export interface SequentialBuilderInstance {
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
  getOutput(): SequentialEntry[];
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
 */
export interface ValueParser {
  parse(val: any, context?: { tagName: string; isAttribute: boolean; attrName?: string }): any;
}

export class SequentialBuilderFactory {
  constructor(options?: Partial<FactoryOptions>);
  getInstance(factoryOptions: FactoryOptions): SequentialBuilderInstance;
  registerValueParser(name: string, parser: ValueParser): void;
}
