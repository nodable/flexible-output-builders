import BaseOutputBuilder from './BaseOutputBuilder.js';
import ValueParserRegistry from './ValueParserRegistry.js';
import { MatcherView } from 'path-expression-matcher';



export default class BaseOutputBuilderFactory {
  constructor(builderOptions = {}) {
    this.builderOptions = builderOptions;
    this.registry = new ValueParserRegistry();
  }

  /**
   * Add or replace a named value parser in the shared registry.
   * Takes effect for all builder instances created after this call.
   *
   * @param {string} name
   * @param {object} parserInstance  Must implement `parse(val, context?)`
   */
  registerValueParser(name, parserInstance) {
    this.registry.register(name, parserInstance);
  }

  /**
   * Called by XMLParser before each document parse to obtain a fresh builder.
   * This resets all value parsers, builds separate pipeline to process values 
   * of tags and attributes and builds a fresh shared context per document.
   *
   * @param {object} options XML Parser options
   * @param {MatcherView} matcherView
   * @returns {BaseOutputBuilder}
   */
  getInstance(parserOptions, matcherView) {
    // return new BaseOutputBuilder(
    //   parserOptions,
    //   this.builderOptions,
    //   matcherView,
    //   this.registry, true
    // );
    throw new Error("getInstance is not implemented");
  }
}