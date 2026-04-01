export interface SkipOptions {
  /** Skip XML declaration `<?xml ... ?>` from output. Default: false */
  declaration?: boolean;
  /** Skip processing instructions (other than declaration) from output. Default: false */
  pi?: boolean;
  /** Skip all attributes from output. Default: true */
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
   * Property name for mixed text content when a tag contains both text and child elements.
   * Default: '#text'
   */
  text?: string;
  /**
   * Property name for CDATA sections.
   * Empty string (default) merges CDATA content into the tag's text value.
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
  /** Group all attributes under this property name. Empty string = inline with tag. Default: '' */
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

  // --- attribute controls ---
  /** Attribute parsing and representation options */
  attributes?: AttributeOptions;

  // --- tag controls ---
  /** Tag parsing options including stop nodes and value parser chain */
  tags?: TagOptions;
  forceArray?: string[] | Expression[];
  forceTextNode?: boolean;
  alwaysArray?: string[] | Expression[];
}


export interface CompactBuilder {
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
  getOutput(): any;
  registeredValParsers: Record<string, ValueParser>;
  /**
   * Optional hook called by the parser when a stop node is fully collected.
   * Implement this in custom OutputBuilder classes to handle stop-node content.
   * `NodeTreeBuilder` and `CompactObjBuilder` implement it and delegate to the
   * `options.onStopNode` callback when supplied.
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

export class CompactBuilderFactory implements OutputBuilderFactory {
  constructor(options?: Partial<FactoryOptions>);
  getInstance(factoryOptions: FactoryOptions): CompactBuilder;
  registerValueParser(name: string, parser: ValueParser): void;
}