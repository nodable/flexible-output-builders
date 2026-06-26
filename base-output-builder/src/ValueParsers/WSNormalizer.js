import { Expression, ExpressionSet } from 'path-expression-matcher';
import BaseValueParser from "./BaseValueParser.js"
// import { FinalValue } from "./../ValueParser.js"

/**
 * Whitespace-normalizing value parser.
 *
 * Collapses runs of whitespace (spaces, tabs, newlines) to a single space
 * and trims leading/trailing whitespace from string tag values. Replaces
 * the `'trim'` parser in the default chain.
 *
 * Normalization is skipped when any of these conditions hold:
 *  1. The value is not a string.
 *  2. The element is an attribute.
 *  3. Any ancestor element has `xml:space="preserve"` (requires the XML
 *     parser to be configured with `{ keep: ['space'] }` on that tag).
 *  4. The current tag path matches a user-supplied exclusion expression
 *     (e.g. `["..pre", "..code", "..script"]`).
 *
 * @example
 * import { WSNormalizer } from '@nodable/base-output-builder';
 * import { CompactBuilderFactory } from '@nodable/compact-builder';
 *
 * const ws = new WSNormalizer({ tags: ['..pre', '..code'] });
 * const builder = new CompactBuilderFactory({
 *   tags: { valueParsers: ['entity', ws, 'boolean', 'number'] },
 * });
 */
export default class WSNormalizer extends BaseValueParser {
  /**
   * @param {{ exclude?: Array<string|import('path-expression-matcher').Expression> }} [options]
   *   `exclude` — paths whose whitespace should be left untouched (e.g. `["..pre", "..code"]`).
   *   Accepts plain expression strings or pre-built `Expression` objects.
   */
  constructor(options, isFinal = false) {
    super(isFinal);
    const exclude = options?.exclude ?? [];

    const set = new ExpressionSet();
    for (const entry of exclude) {
      set.add(typeof entry === 'string' ? new Expression(entry) : entry);
    }
    set.seal();

    /** @type {ExpressionSet} */
    this._excludeSet = set;
  }

  /**
   * Normalize whitespace in `val` unless an exclusion condition applies.
   *
   * @param {*}      val
   * @param {import('../ValueParser.js').Context} [ctx]
   * @returns {*}
   */
  parse(val, ctx) {
    if (typeof val !== 'string') return val;

    if (ctx) {
      // Only normalize element text, not attribute values
      if (ctx.isAttribute) return val;

      if (ctx.matcher) {
        // Respect xml:space="preserve" on any ancestor
        if (ctx.matcher.getAnyParentAttr('xml:space') === 'preserve') return val;

        // Respect user-configured exclusion paths
        if (this._excludeSet.size > 0 && this._excludeSet.matchesAny(ctx.matcher)) return val;
      }
    }

    return normalizeSpaces(val);
  }
}

/**
 * Collapse all whitespace runs to a single space and trim both ends.
 *
 * @param {string} str
 * @returns {string}
 */
function normalizeSpaces(str) {
  return str.replace(/[ \t\r\n]+/g, ' ').trim();
}
