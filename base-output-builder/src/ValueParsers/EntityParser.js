import toNumber from 'strnum';

import { EntityDecoder } from '@nodable/entities';

export default class EntityParser extends EntityDecoder {
  constructor(options) {
    super(options);
  }

  parse(val) {
    if (typeof val === 'string') {
      val = this.decode(val);
    }
    return val;
  }
}
