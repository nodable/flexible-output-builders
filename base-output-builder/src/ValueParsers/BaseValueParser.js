export default class BaseValueParser {
  constructor(IS_FINAL = false) {
    this.IS_FINAL = IS_FINAL;
  }
  /**
    * Called once per parse by `ValueParserPipeline` after construction.
    * Subclasses that need shared XML metadata (version, entities) read it
    * from `ctx` lazily inside `parse()` — it is fully populated by the time
    * the first value is parsed.
    * @param {import('../ValueParser.js').SharedContext} ctx
    */
  init(ctx) { // By ValueParserPipeline
    this.ctx = ctx;
  }

  /**
   * Reset internal state between document parses.
   * Called by `BaseOutputBuilderFactory.resetValueParsers()` before each parse.
   * Stateful subclasses (e.g. `EntityParser`) must override this.
   */
  reset() {
    //Do nothing
  }

  /**
   * Transform `val` and return the result.
   * Return a `FinalValue` instance to stop the pipeline early (unless
   * `this.IS_FINAL` is false, in which case the pipeline continues).
   *
   * @param {*}      val
   * @param {import('../ValueParser.js').Context} [runTimeContext]
   * @returns {*}
   */
  parse(val, runTimeContext) {
    throw new Error("You must implement parse() in a value parser.");
  }

}
