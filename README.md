# Output Builders

A collection of customizable output builders for [flexible-xml-parser](https://github.com/nodable/flexible-xml-parser). Each builder transforms parsed XML into a different JavaScript data structure.

## Packages

| Package | Output shape | Install |
|---|---|---|
| [@nodable/base-output-builder](./base-output-builder) | Base class — extend to build custom formats | `npm i @nodable/base-output-builder` |
| [@nodable/compact-builder](./compact-builder) | Nested objects, minimal structure | `npm i @nodable/compact-builder` |
| [@nodable/sequential-builder](./SequentialBuilder) | Array-per-tag, order preserved | `npm i @nodable/sequential-builder` |
| [@nodable/sequential-stream-builder](./SequentialStreamBuilder) | Same as sequential, streamed to a Writable | `npm i @nodable/sequential-stream-builder` |
| [@nodable/node-tree-builder](./NodeTreeBuilder) | Fixed-shape tree (`elementname` / `child` / attributes) | `npm i @nodable/node-tree-builder` |

## Quick start

```js
import XMLParser from "@nodable/flexible-xml-parser";
import { CompactBuilderFactory } from "@nodable/compact-builder";

const parser = new XMLParser({
  OutputBuilder: new CompactBuilderFactory(),
});

const result = parser.parse(xmlString);
```

See each package's README for options and examples.

---

## Architecture

```
XMLParser
  ├── Input Sources   — string, buffer, stream, feed
  ├── Core Parser     — tokenises and walks XML
  ├── Output Builders — transform nodes into any structures  ← this repo
  └── Value Parsers   — per-value transforms (number, boolean, entity …)
```

The parser calls a fixed set of methods on the builder as it walks the document. Builders are not tied to this parser — any parser that calls the same method contract can use them.

### Parser options vs builder options

**Parser options** (`skip`, `nameFor`, `attributes.groupBy/prefix/suffix`, `onStopNode`, …) are passed to `XMLParser` and forwarded to the builder at parse time via `getInstance(parserOptions, matcher)`. The builder reads them from `this.parserOptions`.

**Builder options** are passed to the factory constructor (`new CompactBuilderFactory(builderOptions)`). These are builder-specific concerns: value parser chains, `forceArray`, `textInChild`, `onClose`, etc. The builder reads them from `this.builderOptions`.

Do not put parser options inside builder options or vice versa.

---

## Summary

### Fields

| Field | BaseOutputBuilder | BaseOutputBuilderFactory |
| --- | --- | --- |
| `parserOptions` | ✓ | |
| `builderOptions` | ✓ | ✓ |
| `registry` | ✓ | ✓ |
| `sharedContext` | ✓ | |
| `tagsPipeline` | ✓ | |
| `attrsPipeline` | ✓ | |
| `matcher` | ✓ | |
| `_rootName` | ✓ | |
| `_pendingStopNode` | ✓ | |

### Methods — which builder overrides which

A blank cell means the base no-op is used. A ✓ means the builder provides its own implementation.

| Method | Base | Compact | Sequential | SequentialStream | NodeTree |
| --- | --- | --- | --- | --- | --- |
| `addElement` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `closeElement` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `addValue` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `addAttribute` | ✓ | | | | |
| `addComment` | ✓ | | ✓ | ✓ | ✓ |
| `addLiteral` | ✓ | | ✓ | ✓ | ✓ |
| `addInstruction` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `addRawValue` | ✓ | | | | |
| `addInputEntities` | ✓ | | | | |
| `addDeclaration` | ✓ | | | | |
| `onExit` | ✓ | | ✓ | ✓ | ✓ |
| `onStopNode` | | ✓ | ✓ | ✓ | |
| `getOutput` | ✓ | ✓ | ✓ | ✓ | ✓ |

> `onStopNode` is called by the parser when a stop node closes. Each builder that supports it reads `parserOptions.onStopNode` and invokes it — it is a **parser option**, not a builder option.

### Builder options

Options passed to the factory constructor. Parser-level options are excluded here — see parser docs.

| Option | Compact | Sequential | SequentialStream | NodeTree |
| --- | --- | --- | --- | --- |
| `tags.valueParsers` | ✓ | ✓ | ✓ | ✓ |
| `attributes.valueParsers` | ✓ | ✓ | ✓ | ✓ |
| `textInChild` | | ✓ | ✓ | ✓ |
| `textJoint` | ✓ | | | |
| `forceArray` | ✓ | | | |
| `alwaysArray` | ✓ | | | |
| `forceTextNode` | ✓ | | | |
| `onClose` | | ✓ | ✓ | ✓ |
| `stream` | | | ✓ | |
| `onChunk` | | | ✓ | |
| `space` | | | ✓ | |

### Value parsers

Registered by name on the factory. Pass names or instances in `tags.valueParsers` / `attributes.valueParsers`.

| Parser | Registered name | Options |
| --- | --- | --- |
| `EntitiesValueParser` | `'entity'` | `EntityDecoderOptions` from `@nodable/entities` |
| `NumberValueParser` | `'number'` | strnum options — see base-output-builder typings |
| `BooleanParser` | `'boolean'` | `trueList`, `falseList` |
| `WSNormalizer` | `'ws'` | `exclude` |
| `Trim` | `'trim'` | — |

---

## Custom builders

Extend `BaseOutputBuilder` and `BaseOutputBuilderFactory`:

```js
import { BaseOutputBuilder, BaseOutputBuilderFactory } from '@nodable/base-output-builder';

class MyBuilder extends BaseOutputBuilder {
  constructor(parserOptions, builderOptions, readonlyMatcher, registry) {
    super(parserOptions, builderOptions, readonlyMatcher, registry);
    this.result = [];
  }

  addElement(tag) { /* … */ }
  closeElement()  { /* … */ }
  addValue(text)  { /* … */ }
  getOutput()     { return this.result; }
}

export default class MyBuilderFactory extends BaseOutputBuilderFactory {
  constructor(options = {}) {
    super();
    this.builderOptions = options;
  }

  getInstance(parserOptions, readonlyMatcher) {
    return new MyBuilder(parserOptions, this.builderOptions, readonlyMatcher, this.registry);
  }
}
```

Use `this.tagsPipeline.run(val, context)` and `this.attrsPipeline.run(val, context)` inside the builder to apply the value parser chain. Call `factory.registerValueParser(name, instance)` to add or replace a named parser.

---

## Entity parsing

The default `'entity'` parser uses [@nodable/entities](https://github.com/nodable/val-parsers/blob/main/Entity/docs/EntityDecoder.md). To customise it, pass your own instance:

```js
import { EntitiesValueParser } from '@nodable/base-output-builder';

const evp = new EntitiesValueParser({ ncr: { onNcr: 'allow' } });

const factory = new CompactBuilderFactory({
  attributes: { valueParsers: [evp] }
});
factory.registerValueParser('entity', evp);
```

---

## Development

```bash
npm install        # install all workspace dependencies
npm test           # run tests for all packages
```

## License

MIT © [Amit Gupta](https://solothought.com)

## Links

- [Flexible XML Parser](https://github.com/nodable/flexible-xml-parser)
- [Issues](https://github.com/nodable/flex-output-builders/issues)
- GitHub: [@nodable](https://github.com/nodable)