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
    this.resetValueParsers();
    return new BaseOutputBuilder(parserOptions, readonlyMatcher, this.commonValParsers);
  }

  resetValueParsers() {
    for (const parser of Object.values(this.commonValParsers)) {
      if (parser && parser.reset) {
        parser.reset();
      }
    }
  }
}