
import EntityParser from './ValueParsers/EntityParser.js';
import WSNormalizer from './ValueParsers/WSNormalizer.js';
import trimParser from './ValueParsers/trim.js';
import booleanParser from './ValueParsers/booleanParser.js';
import numberParser from './ValueParsers/number.js';
// import currencyParser from './ValueParsers/currency.js';
import BaseValueParser from './ValueParsers/BaseValueParser.js';


const defaultValParsers = {
  "entity": new EntityParser(),
  "trim": new trimParser(),
  "ws": new WSNormalizer(),
  "boolean": new booleanParser(),
  "number": new numberParser({ hex: true, leadingZeros: true, eNotation: true }),
  // "currency": new currencyParser(),
};

export default class ValueParserRegistry {
  constructor() {
    this.registered = { ...defaultValParsers };
  }

  /**
   * @param {string} name
   * @param {BaseValueParser} parser
   */
  register(name, parser) {
    if (!name || typeof name !== 'string') {
      throw new Error('name must be a string');
    }
    if (!parser) {
      throw new Error('parser is required');
    }
    if (!parser.reset || typeof parser.reset !== 'function') {
      throw new Error('parser must implement reset()');
    }
    if (!parser.parse || typeof parser.parse !== 'function') {
      throw new Error('parser must implement parse()');
    }
    this.registered[name] = parser;
  }

  reset(name) {
    this.registered[name]?.reset();
  }

  resetAll() {
    for (const vp in this.registered) {
      this.registered[vp]?.reset();
    }
  }

  /**
   * 
   * @param {string} name 
   * @returns {BaseValueParser}
   */
  get(name) {
    const ret = this.registered[name];
    if (!ret) {
      throw new Error('parser not found: ' + name);
    }
    return ret;
  }
}