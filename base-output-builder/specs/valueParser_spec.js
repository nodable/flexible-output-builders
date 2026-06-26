import { buildOptions } from './../src/ParserOptionsBuilder.js';
import XMLParser from "@nodable/flexible-xml-parser";
import BaseOutputBuilderFactory from "../src/BaseOutputBuilderFactory.js";
import BaseOutputBuilder from "../src/BaseOutputBuilder.js";
import { SharedContext, ValueParserPipeline } from "../src/ValueParser.js";
import BaseValueParser from '../src/ValueParsers/BaseValueParser.js';

import {
  runAcrossAllInputSources,
  runAcrossAllInputSourcesWithFactory,
  frunAcrossAllInputSourcesWithFactory
} from "../../test-helpers/testRunner.js";

class Counter extends BaseValueParser {
  constructor() {
    super();
    this.counter = 0;
  }
  parse() {
    this.counter++;
  }

  reset() {
    this.counter = 0;
  }
}

// Base factory – resets parsers by default
class MyBuilderFactory extends BaseOutputBuilderFactory {
  constructor(builderOptions) {
    super();
    this.options = buildOptions(builderOptions);
  }

  getInstance(parserOptions, readonlyMatcher) {
    return new MyBuilder(
      parserOptions,
      this.options,
      readonlyMatcher,
      this.registry
    );
  }
}

// Builder class – matches BaseOutputBuilder constructor signature:
// (options, matcherView, registry, resetPipelines?)
// Pipelines and SharedContext are built inside BaseOutputBuilder's constructor.
class MyBuilder extends BaseOutputBuilder {
  constructor(parserOptions, builderOptions, readonlyMatcher, registry, resetPipeLines = true) {
    super(parserOptions, builderOptions, readonlyMatcher, registry, resetPipeLines);
    this.options = builderOptions;
  }

  addElement() { }
  addValue(value) { }
  closeElement(matcher) {
    // Use tagsPipeline.run() — parseValue() was removed in v2
    this.tagsPipeline.run(this.textValue, null);
  }
  getOutput() { }
}

describe("Value Parser", function () {

  it("should not reset counter", () => {
    // Factory that skips reset – override resetValueParsers to do nothing
    class NoResetFactory extends MyBuilderFactory {
      getInstance(parserOptions, readonlyMatcher) {
        return new MyBuilder(
          parserOptions,
          this.options,
          readonlyMatcher,
          this.registry,
          false
        );
      }
    }

    const builderOpt = { tags: { valueParsers: ["counter"] } };
    const builderFactory = new NoResetFactory(builderOpt);
    const counter = new Counter();
    builderFactory.registerValueParser("counter", counter);

    const parser = new XMLParser({ OutputBuilder: builderFactory });

    parser.parse("<a>2<b>3</b><b/></a>");
    expect(counter.counter).toBe(3);
    parser.parse("<a><b/><b/><b/></a>");
    expect(counter.counter).toBe(7);  // persists: 3 + 4 = 7
  });

  it("should reset counter", () => {
    // Uses MyBuilderFactory which calls reset in getInstance and inherits resetValueParsers
    const builderOpt = { tags: { valueParsers: ["counter"] } };
    const builderFactory = new MyBuilderFactory(builderOpt);
    const counter = new Counter();
    builderFactory.registerValueParser("counter", counter);

    const parser = new XMLParser({ OutputBuilder: builderFactory });

    parser.parse("<a>2<b>3</b><b/></a>");
    expect(counter.counter).toBe(3);
    parser.parse("<a><b/><b/><b/></a>");
    expect(counter.counter).toBe(4);  // reset before second parse, so only 4 counted
  });

});
