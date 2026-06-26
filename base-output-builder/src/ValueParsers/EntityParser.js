import { EntityDecoder, XML, COMMON_HTML, ENTITY_ACTION } from '@nodable/entities';
import { isUnsafe, VALID_CONTEXTS } from "is-unsafe"

import BaseValueParser from "./BaseValueParser.js"

const defaultOptions = {
  namedEntities: { ...XML },
  numericAllowed: true,
  //limit: {},
  onInputEntity: (name, value) =>
    isUnsafe(value, [VALID_CONTEXTS.XML])
      ? ENTITY_ACTION.BLOCK : ENTITY_ACTION.ALLOW,
}

export default class EntityParser extends BaseValueParser {
  #seen = false;
  #decoder = null;
  #options = null;
  /**
   * @param {object} options 
   * @param {boolean} isFinal true if it should skip rest of the value parsers in the chain
   */
  constructor(options, isFinal = false) { // By user options (optional)
    super(isFinal);
    this.#options = {
      ...defaultOptions,
      ...(options || {}),
      // Additive merge: user-supplied namedEntities extend, not replace, the defaults.
      namedEntities: { ...defaultOptions.namedEntities, ...(options?.namedEntities || {}) },
    };
  }

  #ensureDecoder() {
    if (!this.#decoder) {
      this.#decoder = new EntityDecoder(this.#options);
    }
    if (!this.#seen) {
      const version = this.ctx?.get('xmlVersion');
      const entities = this.ctx?.get('inputEntities');
      if (version) this.#decoder.setXmlVersion(version);
      if (entities) this.#decoder.addInputEntities(entities);
      this.#seen = true;
    }
  }

  reset() {
    this.#seen = false;
    if (this.#decoder) {
      this.#decoder.reset();
    }
  }

  parse(val) {
    if (typeof val !== 'string') return val;
    this.#ensureDecoder();
    return this.#decoder.decode(val);
  }

}
