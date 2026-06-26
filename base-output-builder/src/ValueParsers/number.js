import toNumber from 'strnum';
import BaseValueParser from "./BaseValueParser.js"
import { FinalValue } from "./../ValueParser.js"

/**
 * Number parser class that wraps the strnum toNumber function
 * Provides consistent API for value parsing in flexible-xml-parser
 */
export default class numParser extends BaseValueParser {
  constructor(options, isFinal = false) {
    super(isFinal);
    this.options = options || {};
  }

  /**
   * Parse a value, converting strings to numbers based on options
   * @param {*} val - Value to parse
   * @returns {*} Parsed value (number if successfully parsed, otherwise original value)
   */
  parse(val) {
    if (typeof val === 'string') {
      const newval = toNumber(val, this.options);
      if (typeof newval !== val) {
        return this.IS_FINAL ? new FinalValue(newval) : newval;
      }
    }
    return val;
  }
}
