
### 26 Jun 2026

Base Output Builder v2.0.0
- Value parser implementation cleanup.
- Skip value parsing for stop node to imprve performance
- Add WS Normalizer to support `xml:space`, and tag based exclude.
- change default pipeline to use 'ws' instead of 'trim'
- Support shared context. Useful for value parsers
- Refactor Runtime Context to Context class instead of inline object.
- Simplify typings to avoid parser level configuration.
- No merging of builder and parser options. It'll improve performance, fix bugs and clean code.
- Shift value parsing logic from local method to ValueParserPipeline class.
- Add `FinalValue` to stop value parsing early.
- improve documentation.
- upgrade to `"@nodable/entities": "^2.2.0"`
- Use `"is-unsafe": "^1.0.1"` in EntityParser.
- upgrade to `"path-expression-matcher": "^1.6.1"` to preserve whitespaces in tags and performance improvement.
- upgrade to `"strnum": "^2.4.1"` to support unicode numbers.


Compact Builder v2.0.0
- remove `onTagClose` method due to incomplete implementation.
- Update Base impl
- improve documentation.
- move `onStopNode` implementation to base class.
- update construction signature as per base class
- Internal: Use ExpressionSet for alwaysarray to improve performance
- Shift alwaysarray construction option builder file.

Sequential Builder v2.0.0
- Update Base impl
- improve documentation.
- move `onStopNode` implementation to base class.
- update construction signature as per base class


Sequential Stream Builder v2.0.0
- Update Base impl
- improve documentation.
- move `onStopNode` implementation to base class.
- update construction signature as per base class

Node Tree Builder v2.0.0
- Update Base impl
- improve documentation.
- move `onStopNode` implementation to base class.
- update construction signature as per base class