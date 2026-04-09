import type { ReadonlyMatcher } from "path-xml-parser";

/**
 * A custom entity map: keys are entity names (without & and ;),
 * values are replacement strings.
 * @example { 'copy': '©', 'trade': '™' }
 */
export type EntityMap = Record<string, string>;

/**
 * Constructor options for EntitiesValueParser.
 * Controls which entity tables are active and replacement-time security limits.
 */
export interface EntitiesValueParserOptions {
  /**
   * Built-in XML entities: lt, gt, apos, quot, amp.
   *   true (default) → use built-in set
   *   false / null   → disable XML entity replacement entirely
   *   EntityMap      → use this custom map instead of the built-in set
   */
  default?: boolean | null | EntityMap;

  /**
   * HTML named entities: &nbsp;, &copy;, &reg;, numeric refs, etc.
   *   false / null (default) → disabled
   *   true                   → use built-in HTML entity set
   *   EntityMap              → use this custom map instead of the built-in set
   */
  html?: boolean | null | EntityMap;

  /**
   * Whether entities registered via addEntity() are applied during replacement.
   *   true (default) → applied
   *   false / null   → stored but not applied
   */
  external?: boolean | null;

  /**
   * Max total entity references expanded per document.
   * Protects against Billion Laughs style attacks.
   * Default: 0 (unlimited)
   */
  maxTotalExpansions?: number;

  /**
   * Max total characters added to output by entity expansion per document.
   * Default: 0 (unlimited)
   */
  maxExpandedLength?: number;

  /**
   * Initial external entity map loaded at construction time.
   * @example { copy: '©', trade: '™' }
   */
  entities?: EntityMap;
}

/**
 * Low-level entity replacement engine.
 * Holds entity tables (XML built-ins, HTML built-ins, external, DOCTYPE)
 * and performs replacement with optional security limits.
 *
 * Most users should use EntitiesValueParser instead, which wraps this class
 * and implements the ValueParser interface.
 */
export declare class EntitiesParser {
  constructor(options?: EntitiesValueParserOptions);
  addExternalEntities(map: EntityMap): void;
  addExternalEntity(key: string, val: string): void;
  /** Load DOCTYPE entities and reset per-document expansion counters. */
  addInputEntities(entities: object): void;
  replaceEntitiesValue(val: string): string;
  parse(val: string): string;
}

/**
 * Value parser that expands entity references in tag text and attribute values.
 *
 * Register an instance under 'entity' on an output builder:
 * ```ts
 * const evp = new EntitiesValueParser({ default: true, html: false });
 * myBuilder.registerValueParser('entity', evp);
 * ```
 *
 * External entities are registered directly on the instance:
 * ```ts
 * evp.addEntity('copy', '©');
 * ```
 *
 * DOCTYPE entities are forwarded automatically by the output builder —
 * no manual wiring needed.
 */
export declare class EntitiesValueParser implements ValueParser {
  constructor(options?: EntitiesValueParserOptions);
  /** Register a custom entity. Key must not contain '&' or ';'. */
  addEntity(key: string, value: string): void;
  /** Receive DOCTYPE entities from the output builder. Resets per-document counters. */
  addInputEntities(entities: object): void;
  parse(val: any, context?: object): any;
}

/**
 * Constants for the `elementType` field in a value-parser context object.
 * Discriminates between tag text values and attribute values.
 */
export declare const ElementType: {
  readonly ELEMENT: 'ELEMENT';
  readonly ATTRIBUTE: 'ATTRIBUTE';
};

/**
 * Abstract base class for custom output builders.
 * Extend this to implement a fully custom output representation.
 *
 * Subclasses must implement: `addTag`, `closeTag`, `addValue`, `getOutput`.
 * Optionally override: `addAttribute`, `addComment`, `addCdata`, `addPi`,
 * `addDeclaration`, `onStopNode`.
 *
 * @example
 * import { BaseOutputBuilder } from '@nodable/base-output-builder';
 * class MyBuilder extends BaseOutputBuilder { ... }
 */
export declare class BaseOutputBuilder implements BaseOutputBuilderInterface {
  constructor(readonlyMatcher: any);
  addAttribute(name: string, value: any, matcher: any): void;
  parseValue(val: any, valParsers: Array<string | ValueParser>, context?: object): any;
  addComment(text: string): void;
  addLiteral(text: string): void;
  addRawValue(text: string): void;
  addDeclaration(): void;
  addInstruction(name: string): void;
  /**
   * Receive DOCTYPE entities from the XML parser and forward them to any
   * registered value parser that implements addInputEntities().
   * Called automatically — no manual wiring needed.
   */
  addInputEntities(entities: object): void;
  addElement(tag: { name: string }, matcher: any): void;
  closeElement(matcher: any): void;
  addValue(text: string, matcher: any): void;
  getOutput(): any;
  registeredValParsers: Record<string, ValueParser>;
  onStopNode?(
    tagDetail: { name: string; line: number; col: number; index: number },
    rawContent: string,
    matcher: any,
  ): void;
}

/**
 * Extended boolean parser that also maps "yes"/"no"/"1"/"0" to booleans.
 * Works on scalar strings and arrays of strings.
 */
export declare function booleanParserExt(val: string | string[]): boolean | string | (boolean | string)[];

/**
 * Join parser — joins an array of values into a single string.
 * @param val  Array of values to join.
 * @param by   Separator string. Default: `' '`
 */
export declare function joinParser(val: any[], by?: string): string | any[];

/**
 * Context object passed to value parsers during parsing
 */
export interface ValueParserContext {
  /** Name of the current element or attribute */
  elementName: string;
  /** Original value before parsing */
  elementValue: any;
  /** Type of element being parsed */
  elementType: 'ELEMENT' | 'ATTRIBUTE';
  /** Read-only matcher for inspecting path, attributes, position */
  matcher: any;
  /** Whether this is a leaf node (no children). Null when not yet determinable */
  isLeafNode: boolean | null;
}

/**
 * Value parser interface - all value parsers must implement this
 */
export interface ValueParser {
  /** Parse and transform a value */
  parse(val: any, context?: ValueParserContext): any;
  /** Optional: receive DOCTYPE entities from the parser */
  addInputEntities?(entities: object): void;
}

/**
 * Output builder instance interface - defines the contract for all output builders
 */
export interface BaseOutputBuilderInterface {
  /** Start a new element */
  addElement(tag: { name: string }, matcher: any): void;
  /** Close the current element */
  closeElement(matcher: any): void;
  /** Add an attribute to the current element */
  addAttribute(name: string, value: any, matcher: any): void;
  /** Add text content to the current element */
  addValue(text: string, matcher: any): void;
  /** Add a comment node */
  addComment(text: string): void;
  /** Add a CDATA section */
  addLiteral(text: string): void;
  /** Add XML declaration */
  addDeclaration(): void;
  /** Add processing instruction */
  addInstruction(name: string): void;
  /** Receive DOCTYPE entities */
  addInputEntities(entities: object): void;
  /** Get the final parsed output */
  getOutput(): any;
  /** Optional: hook for stop nodes with raw content */
  onStopNode?(
    tagDetail: { name: string; line: number; col: number; index: number },
    rawContent: string,
    matcher: any,
  ): void;
  /** Registered value parsers */
  registeredValParsers: Record<string, ValueParser>;
}

export interface BaseOutputBuilderFactory {
  /**
   * Called by XML Parser to get an instance of the output builder
   * @param parserOptions 
   * @param readonlyMatcher 
   */
  getInstance(parserOptions: object, readonlyMatcher: ReadonlyMatcher): BaseOutputBuilderInterface;
  /**
   * Called by user to register a value parser.
   * @param name - Name of the value parser
   * @param parser - Value parser instance
   */
  registerValueParser(name: string, parser: ValueParser): void;
}

/**
 * Factory function that returns a default set of commonly used value parsers
 * @returns Record of value parsers (entity, trim, boolean, number, currency)
 */
export declare function commonValueParsers(): Record<string, ValueParser>;