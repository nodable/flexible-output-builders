import BaseOutputBuilder, { commonValueParsers } from './BaseOutputBuilder.js';

export default class BaseOutputBuilderFactory {
  constructor() {
    //this.options = buildOptions(builderOptions);
    this.commonValParsers = commonValueParsers();
  }

  registerValueParser(name, parserInstance) {
    //This would replace the default value parser with the user provided value parser
    this.commonValParsers[name] = parserInstance;
  }

  getInstance(parserOptions, readonlyMatcher) {
    const valParsers = { ...this.commonValParsers };
    return new BaseOutputBuilder(parserOptions, this.options, valParsers, readonlyMatcher);
  }
}