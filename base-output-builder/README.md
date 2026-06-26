# @nodable/base-output-builder

Base classes and value-parsing primitives for `@nodable/flexible-xml-parser` output builders.

All output builders (`@nodable/compact-builder`, `@nodable/sequential-builder`, etc.) extend
`BaseOutputBuilder` and `BaseOutputBuilderFactory` from this package.

---

## Installation

```bash
npm install @nodable/base-output-builder
```

---

## Value Parser Pipeline

Value parsers transform text extracted from XML — tag content, CDATA, and attribute values.
They run left-to-right; each parser receives the output of the previous one.

### Default chains

| Chain | Parsers |
|---|---|
| Tags | `['ws', 'entity', 'boolean', 'number']` |
| Attributes | `['entity', 'number', 'boolean']` |

### Configuring the pipeline

Chains are configured on the **builder factory**, not on `XMLParser` directly:

```javascript
import { CompactBuilderFactory } from '@nodable/compact-builder';

// Custom chain
const builder = new CompactBuilderFactory({
  tags:       { valueParsers: ['ws', 'entity', 'boolean', 'number'] },
  attributes: { valueParsers: ['entity', 'number'] },
});

// Disable all transformation — raw strings only
const rawBuilder = new CompactBuilderFactory({
  tags:       { valueParsers: [] },
  attributes: { valueParsers: [] },
});
```

Each entry is either a **registered name** (string) or a **parser instance** with a
`parse(val, context?)` method.

---

## Built-in Value Parsers

### `'entity'` — `EntitiesValueParser`

Expands XML entity references (`&lt;`, `&amp;`, etc.), optional HTML entities, and
DOCTYPE-declared entities.

```javascript
import { EntitiesValueParser } from '@nodable/base-output-builder';

const evp = new EntitiesValueParser({
  default:  true,   // built-in XML entities (default: true)
  html:     false,  // HTML named entities like &nbsp; (default: false)
  external: true,   // entities added via addEntity() (default: true)
});
factory.registerValueParser('entity', evp);
```

### `'ws'` — `WSNormalizer`

Collapses runs of whitespace (spaces, tabs, newlines) to a single space and trims both ends.
**Replaces `'trim'`** in the default chain.

Normalization is automatically skipped when:
- The value is not a string
- The element is an attribute
- Any ancestor element has `xml:space="preserve"`
- The tag path matches a user-supplied exclusion list

```javascript
import { WSNormalizer } from '@nodable/base-output-builder';

const ws = new WSNormalizer({
  exclude: ['..pre', '..code', '..script'],  // leave whitespace untouched in these
});
factory.registerValueParser('ws', ws);
```

> **Note:** `'trim'` remains registered as an alias for `WSNormalizer` for backward
> compatibility. If you only need edge trimming without collapsing internal whitespace,
> supply a custom parser instead.

### `'boolean'`

Converts `"true"` and `"false"` (case-insensitive) to JavaScript `true`/`false`. All other values pass through unchanged. You can pass list of true and false values.

```javascript
import { BooleanParser } from '@nodable/base-output-builder';

const builder = new CompactBuilderFactory();
builder.registerValueParser('boolean', new BooleanParser({ trueList: ['yes', 'y'], falseList: ['no', 'n'] }));
// "yes" becomes true, "no" becomes false, "true" and "false" stay as strings
```

This final the value on successful match and doesn't process further value parsers. However, you can override this setting.

### `'number'` — `NumberValueParser`

Converts numeric strings to JS numbers using the [`strnum`](https://www.npmjs.com/package/strnum) library.

| Option | Default | Description |
|---|---|---|
| `hex` | `true` | Parse `0x…` hex literals |
| `leadingZeros` | `true` | Parse `007` as `7` |
| `eNotation` | `true` | Parse `1.5e3` as `1500` |
| `infinity` | `"original"` | What to do with overflow: `"original"`, `"infinity"`, `"string"`, `"null"` |

Check `strnum` package for more details. To customise, import and register directly:

```javascript
import { NumberValueParser } from '@nodable/base-output-builder';

const builder = new CompactBuilderFactory();
builder.registerValueParser('number', new NumberValueParser({ leadingZeros: false }));
// "007" stays as "007"; 9.99 converts normally
```

This final the value on successful match and doesn't process further value parsers. However, you can override this setting.


## Stopping the Chain Early — `FinalValue`

A parser can return `new FinalValue(value)` to short-circuit the pipeline. No subsequent
parsers run, and `value` is returned directly.

```javascript
import { FinalValue } from '@nodable/base-output-builder';

class NullParser {
  parse(val) {
    if (val === 'null') return new FinalValue(null); // stop here
    return val;
  }
}

factory.registerValueParser('null', new NullParser());
```

---

## Custom Value Parsers

Any object with a `parse(val, context?)` and `reset()` method works as a value parser:

```javascript
class UpperCaseParser extends BaseValueParser{
  constructor(options, isfinal){
    super(isfinal);
  }
  parse(val) {
    return typeof val === 'string' ? val.toUpperCase() : val;
  }
}

const builder = new CompactBuilderFactory({
  tags: { valueParsers: ['entity', new UpperCaseParser(), 'boolean', 'number'] },
});
```

Register by name to reference in multiple chains:

```javascript
factory.registerValueParser('upper', new UpperCaseParser());
// now usable by name in any valueParsers array
```

### The context object

Each parser receives a typed `Context` as its second argument:

```javascript
import { Context } from '@nodable/base-output-builder';

class TagOnlyParser {
  parse(val, context) {
    // skip attributes
    if (context?.isAttribute) return val;
    return doSomething(val);
  }
}
```

| Field | Type | Description |
|---|---|---|
| `elementName` | `string` | Tag or attribute name |
| `isAttribute` | `boolean \| null` | `true` for attribute values, `false` for tag text |
| `matcher` | `MatcherView \| null` | Read-only path inspector |
| `isLeafNode` | `boolean \| null` | True when element has no child elements |

---

## ValueParserPipeline

Builder instances expose two pipelines for use in subclass implementations:

```javascript
// In a custom closeElement() — preferred over this.parseValue()
const result = this.tagsPipeline.run(textValue, context);

// In a custom addAttribute() — preferred over this.parseValue()
const result = this.attrsPipeline.run(attrValue, context);
```

---

## Custom Output Builders

Extend `BaseOutputBuilder` and `BaseOutputBuilderFactory`:

`BaseOutputBuilder` needs following optional arguments to build the pipelines, and common work for your custom output builder. However, if you're overriding all methods and preparing value parser pipeline your own then you can skip passing these arguments.

parser options
```
attributes{ prefix: string, suffix: string},
skip: { comment: boolean, cdata: boolean}
nameFor: { comment: string, cdata: string}
```

builder options
```
tags: {valueParsers: []}
attributes{ valueParsers: []},
```

```javascript
import { BaseOutputBuilder, BaseOutputBuilderFactory } from '@nodable/base-output-builder';

class TagListBuilder extends BaseOutputBuilder {
  constructor(...args) {
    super(...args);
    this.tags = [];
  }
  addElement(tag) { this.tags.push(tag.name); }
  getOutput()     { return this.tags; }
}

class TagListBuilderFactory extends BaseOutputBuilderFactory {
  constructor(builderOptions) {
    super();
    this.builderOptions = builderOptions ?? {};
  }

  getInstance(parserOptions, readonlyMatcher) {
    return new TagListBuilder(parserOptions, builderOptions, readonlyMatcher, this.registry);
  }
}
```

### Methods to override

| Method | Called when | Notes |
|---|---|---|
| `addElement(tag)` | Opening tag | |
| `closeElement()` | Closing tag | Use `this.tagsPipeline.run()` for values |
| `addAttribute(name, value, matcher)` | Each attribute | Use `this.attrsPipeline.run()` for values |
| `addValue(text)` | Text content | |
| `getOutput()` | Parse complete | Return the result |



---

## Parser Order

- Put `'ws'` first — trim and collapse whitespace before any interpretation
- Put `'entity'` before `'boolean'` and `'number'` — downstream parsers receive clean characters, not `&amp;` etc.
- Put `'number'` after `'boolean'` — once a value is `true`, number sees a non-string and passes through

Recommended: `['ws', 'entity', 'boolean', 'number']`

---

## Migrating to v2

This is a **major version** with breaking changes to `BaseOutputBuilder`, `BaseOutputBuilderFactory`,
and all output builder packages (`@nodable/compact-builder`, `@nodable/sequential-builder`,
`@nodable/node-tree-builder`, `@nodable/sequential-stream-builder`, etc.).

All affected packages bump to their own new major version at the same time.

### 1 — `BaseOutputBuilder` constructor signature changed

The base class now accepts `(parserOptions, builderOptions, matcherView, registry, resetPipelines?)` and builds both `ValueParserPipeline` instances and a fresh `SharedContext` internally. Subclasses no longer receive or manage pipelines directly.

**After**
```javascript
class MyBuilder extends BaseOutputBuilder {
  constructor(parserOptions, builderOptions, readonlyMatcher, registry) {
    super(parserOptions, builderOptions, readonlyMatcher, registry); // pipelines + SharedContext built here
    // this.tagsPipeline, this.attrsPipeline, this.sharedContext are now available
    // ...
  }
}
```

### 2 — `getInstance()` passes resolved options; pipelines are built automatically

`BaseOutputBuilder`'s constructor now builds both `ValueParserPipeline` instances and a
fresh `SharedContext` from `options.tags.valueParsers` / `options.attributes.valueParsers`.
`getInstance()` only needs to resolve and merge options, then hand the registry.

**After**
```javascript
getInstance(parserOptions, readonlyMatcher) {
  return new MyBuilder(parserOptions, this.builderOptions, readonlyMatcher, this.registry);
}
```

### 3 — `Context` is now a class, not a plain object

**Before**
```javascript
const context = {
  elementName:  tagName,
  elementValue: text,
  elementType:  ElementType.ELEMENT,
  matcher:      this.matcher,
  isLeafNode:   !hasElementChildren,
};
```

**After**
```javascript
const context = new Context(
  tagName,              // elementName
  this.matcher,         // matcher
  !hasElementChildren,  // isLeafNode
  false,                // isAttribute (false = tag text, true = attribute value)
);
```

### 4 — Replace `parseValue()` with `tagsPipeline.run()` / `attrsPipeline.run()`

**Before**
```javascript
const parsed = this.parseValue(text, this.options.tags.valueParsers, context);
```

**After**
```javascript
const parsed = this.tagsPipeline.run(text, context);
```

You can decide your own way of parsing though.

### 5 — Default tag chain now includes `'ws'` instead of `'trim'`

| | Before | After |
|---|---|---|
| Tags default chain | `['entity', 'trim', 'boolean', 'number']` | `['ws', 'entity', 'boolean', 'number']` |
| Attributes default chain | `['entity', 'number', 'boolean']` | unchanged |

`'trim'` remains registered as an alias for `WSNormalizer` so existing custom chains that
name it explicitly continue to work. The behavioural difference is that `WSNormalizer` also
**collapses internal whitespace runs** to a single space, not just edge-trims. If you relied
on interior whitespace being preserved, either:
- add the tag path to `WSNormalizer`'s exclusion list, or
- register a custom parser that only trims edges.

### 6 — `SharedContext` is created automatically per document parse

A `SharedContext` is created inside `BaseOutputBuilder`'s constructor for every new
builder instance (and `getInstance()` returns a fresh builder per document). It flows
automatically to both `ValueParserPipeline` instances and is available on
`this.sharedContext`. No manual wiring is needed.

It carries well-known keys that parsers need at runtime:

| Key | Set by | Used by |
|---|---|---|
| `'xmlVersion'` | `BaseOutputBuilder.addAttribute()` when `version` is read from `<?xml …?>` | `EntityParser` — adjusts entity rules per XML version |
| `'inputEntities'` | `BaseOutputBuilder.addInputEntities()` when a DOCTYPE is parsed | `EntityParser` — expands document-declared entities |


> **Why a fresh context per parse?**  A single `SharedContext` instance that lived on the
> factory would let values from one document (`xmlVersion`, `inputEntities`) bleed into the
> next. Because `BaseOutputBuilder` creates one in its constructor and `getInstance()` returns
> a new builder per parse, each document gets a clean slate automatically.

### 7 — Custom value parsers should extend `BaseValueParser`

A new `BaseValueParser` base class is now the recommended foundation for all value parsers.
It handles `IS_FINAL` and the `init(ctx)` / `reset()` lifecycle that the pipeline calls.

**Before** — ad-hoc class, no lifecycle hooks:
```javascript
class MyParser {
  constructor(options) {
    this.options = options || {};
  }
  parse(val) {
    // …
    return val;
  }
}
```

**After** — extend `BaseValueParser`:
```javascript
import { BaseValueParser, FinalValue } from '@nodable/base-output-builder';

class MyParser extends BaseValueParser {
  constructor(options, isFinal = false) {
    super(isFinal);           // sets this.IS_FINAL
    this.options = options || {};
  }

  // Called once per parse with the SharedContext — read from ctx inside parse() lazily.
  // init(ctx) is inherited; override only if you need to pre-read something at init time.

  // Override if your parser caches state between values (e.g. a lazy-built decoder).
  reset() {
    // clear your cached state here
  }

  parse(val, runTimeContext) {
    // …
    const result = transform(val);
    return this.IS_FINAL ? new FinalValue(result) : result;
  }
}
```

Key members provided by `BaseValueParser`:

| Member | Description |
|---|---|
| `this.IS_FINAL` | When `true`, wrap the return value in `new FinalValue(…)` to stop the pipeline |
| `this.ctx` | The `SharedContext` injected by `init(ctx)` — read XML version and entities from here |
| `init(ctx)` | Called by the pipeline after construction; stores `ctx` on `this.ctx` |
| `reset()` | Called by `ValueParserPipeline.resetAll()` before each parse; no-op by default |

Using `SharedContext` data inside a parser — read lazily inside `parse()` to guarantee the
context is fully populated (the XML declaration and DOCTYPE are parsed before any values):

```javascript
parse(val) {
  const version  = this.ctx?.get('xmlVersion');    // e.g. 1.1
  const entities = this.ctx?.get('inputEntities'); // e.g. { copy: '©', … }
  // …
}
```

---

### Summary checklist for custom builder authors

- [ ] Change constructor signature to `(parserOptions, builderOptions, readonlyMatcher, registry)`
- [ ] Replace plain context objects with `new Context(name, matcher, isLeafNode, isAttribute)`
- [ ] Replace `this.parseValue(text, ..., context)` with `this.tagsPipeline.run(text, context)`
- [ ] Add `?.` optional chaining to all `parserOptions.*` spreads in options merges
- [ ] Extend `BaseValueParser` in custom value parsers (implement `reset()` for stateful parsers)
- [ ] Bump your package to a new **major** version