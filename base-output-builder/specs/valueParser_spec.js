
import { buildOptions } from './../src/ParserOptionsBuilder.js';
import XMLParser from "@nodable/flexible-xml-parser";
import BaseOutputBuilderFactory from "../src/BaseOutputBuilderFactory.js";
import BaseOutputBuilder from "../src/BaseOutputBuilder.js";

import {
  runAcrossAllInputSources,
  runAcrossAllInputSourcesWithFactory,
  frunAcrossAllInputSourcesWithFactory
} from "../../test-helpers/testRunner.js";

class Counter {
  constructor() {
    this.counter = 0;
  }
  parse() {
    this.counter++;
  }

  reset() {
    this.counter = 0;
  }
}

class MyBuilderFactory extends BaseOutputBuilderFactory {
  constructor(pOpt, builderOptions) {
    super();
    this.options = buildOptions(builderOptions);
  }

  getInstance(parserOptions) {
    //not calling reset
    super.resetValueParsers();
    const valParsers = { ...this.commonValParsers };
    return new MyBuilder(parserOptions, this.options, valParsers);
  }
}

class MyBuilder extends BaseOutputBuilder {
  constructor(parserOptions, options, valParsers) {
    super();
    this.options = { ...parserOptions, ...options }
    this.registeredValParsers = valParsers
  }

  addElement() { }
  addValue(value) { }
  closeElement(matcher) {
    this.parseValue(matcher.textValue, this.options.tags.valueParsers, matcher);
  }
  getOutput() { }
}

describe("Entity Parser", function () {

  it("should not reset counter", () => {
    class MyBuilderFactory extends BaseOutputBuilderFactory {
      constructor(pOpt, builderOptions) {
        super();
        this.options = buildOptions(builderOptions);
      }

      getInstance(parserOptions) {
        //not calling reset
        // super.resetValueParsers();
        const valParsers = { ...this.commonValParsers };
        return new MyBuilder(parserOptions, this.options, valParsers);
      }
    }

    const builderOpt = { tags: { valueParsers: ["counter"] } }
    const builderFactory = new MyBuilderFactory({}, builderOpt);
    const counter = new Counter();
    builderFactory.registerValueParser("counter", counter);

    const parser = new XMLParser({ OutputBuilder: builderFactory });

    parser.parse("<a>2<b>3</b><b/></a>");
    expect(counter.counter).toBe(3);
    parser.parse("<a><b/><b/><b/></a>");
    expect(counter.counter).toBe(7);
  });

  it("should reset counter", () => {
    class MyBuilderFactory extends BaseOutputBuilderFactory {
      constructor(pOpt, builderOptions) {
        super();
        this.options = buildOptions(builderOptions);
      }

      getInstance(parserOptions) {
        //not calling reset
        super.resetValueParsers();
        const valParsers = { ...this.commonValParsers };
        return new MyBuilder(parserOptions, this.options, valParsers);
      }
    }

    const builderOpt = { tags: { valueParsers: ["counter"] } }
    const builderFactory = new MyBuilderFactory({}, builderOpt);
    const counter = new Counter();
    builderFactory.registerValueParser("counter", counter);

    const parser = new XMLParser({ OutputBuilder: builderFactory });

    parser.parse("<a>2<b>3</b><b/></a>");
    expect(counter.counter).toBe(3);
    parser.parse("<a><b/><b/><b/></a>");
    expect(counter.counter).toBe(4);
  });


});