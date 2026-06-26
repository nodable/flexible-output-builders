# Sequential Output Builder

Produces a sequential array where every element is represented as an object with the **tag name directly as a key** pointing to its children array. There is no separate `elementname` property — the structure is array-first throughout.

## Install

```bash
npm install @nodable/sequential-builder
```

## Usage

```js
import XMLParser from "@nodable/flexible-xml-parser";
import { SequentialBuilderFactory } from "@nodable/sequential-builder";

const parser = new XMLParser({
  OutputBuilder: new SequentialBuilderFactory(builderOptions),
  ...parserOptions,
});

const result = parser.parse(xmlString);
// result is always an array
```

---

## Output structure

```
[                              ← getOutput() always returns an array
  {
    [tagName]: Array,          ← tag name → children array (always present, even when empty)
    [groupBy]?: object,        ← attributes as a sibling property (only when non-empty)
    text?: any                 ← only present on leaf nodes (no child element entries)
  }
]
```

### Leaf node (text only, no child elements)

```js
{ span: [], text: "Hello" }
```

### Empty tag (no text, no children)

```js
{ br: [] }
```

### Tag with child elements

```js
{ div: [ /* child entries */ ] }
```

### Tag with attributes and text

```js
{ item: [], attributes: { "@_id": 1 }, text: "hello" }
```

Attributes are a **sibling property** alongside the tag key — they are not nested inside the children array.

### Mixed content (text interleaved with child elements)

Inline text runs appear as `{ "#text": value }` entries inside the children array. The entry itself has no `text` property in this case.

Input:
```xml
<p>Hello <b>world</b>!</p>
```

Output:
```js
[
  {
    p: [
      { "#text": "Hello " },
      { b: [], text: "world" },
      { "#text": "!" }
    ]
  }
]
```

### Basic example

Input:
```xml
<root>
  <child>hello</child>
  <child>world</child>
</root>
```

Output:
```js
[
  {
    root: [
      { child: [], text: "hello" },
      { child: [], text: "world" }
    ]
  }
]
```

---

## Options

> **Parser-level options** (`skip`, `nameFor`, `attributes.groupBy`, `attributes.prefix`,
> `attributes.suffix`) are configured on the XML parser, not the builder factory.
> See the `@nodable/flexible-xml-parser` documentation for those options.

### `textInChild` (default: `false`)

When `true`, text is always stored as a `{ [nameFor.text]: value }` entry in the children array — even on pure leaf nodes that have no element children. The `text` sibling property is never set in this mode.

```js
new SequentialBuilderFactory({ textInChild: true })
```

Input:
```xml
<root><a>hello</a></root>
```

Default (`textInChild: false`):
```js
[ { root: [ { a: [], text: "hello" } ] } ]
```

With `textInChild: true`:
```js
[ { root: [ { a: [ { "#text": "hello" } ] } ] } ]
```

### `tags.valueParsers`

Value parser chain applied to tag text content. Default: `['ws', 'entity', 'boolean', 'number']`.

```js
new SequentialBuilderFactory({
  tags: { valueParsers: [] }   // keep all values as raw strings
})
```

### `attributes.valueParsers`

Value parser chain applied to attribute values. Default: `['entity', 'number', 'boolean']`.

### `tags.stopNodes`

Tag names (or path expressions) at which the parser stops descending and returns the raw inner text unparsed.

```js
new SequentialBuilderFactory({
  tags: { stopNodes: ["..script", "..style"] }
})
```

### `onStopNode`

Called when a stop node is fully collected, before its raw content is stored.

```js
new SequentialBuilderFactory({
  tags: { stopNodes: ["..script"] },
  onStopNode: (tagDetail, rawContent, matcher) => {
    console.log(`<${tagDetail.name}> at line ${tagDetail.line}: ${rawContent.length} chars`);
  }
})
```

### `onClose`

Called when any tag closes, before its entry is pushed to the parent's children array. Return a truthy value to suppress the entry entirely (drop the tag from output).

```js
new SequentialBuilderFactory({
  onClose: (node, matcher) => {
    if (node.tagname === "internal") return true; // drop
  }
})
```

The `node` argument is the fully-built internal node with `tagname`, `children`, `text`, and the attributes groupBy key.