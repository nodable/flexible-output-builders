# Sequential Output Builder

Produces a sequential array where every element is represented as an object with the **tag name directly as a key** pointing to its children array. There is no separate `elementname` property — the structure is array-first throughout.

## Output structure

```
[                          ← getOutput() always returns an array
  {
    [tagName]: Array,      ← tag name → children array (always present, empty for leaf/empty nodes)
    [groupBy]?: object,    ← attributes as a sibling property (only when non-empty)
    text?: any             ← only present on leaf nodes (no child element entries)
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

## Basic example

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

## Install

```bash
npm install @nodable/sequential-builder
```

## Usage

```js
import XMLParser from "@nodable/flexible-xml-parser";
import {SequentialBuilderFactory} from "@nodable/sequential-builder";

const parser = new XMLParser({
  OutputBuilder: new SequentialBuilderFactory(builderOptions),
  ...parserOptions,
});

const result = parser.parse(xmlString);
// result is always an array
```

## Options

### `attributes.groupBy` (default: `"attributes"`)

The property name under which all attributes are collected as a sibling alongside the tag key. The property is **only present** when attributes exist and `skip.attributes` is false.

```js
new SequentialBuilderFactory({
  attributes: { groupBy: "attributes" }  // default
})
```

To use a custom key:

```js
new SequentialBuilderFactory({
  attributes: { groupBy: ":@" }
})
```

### `nameFor.text` (default: `"#text"`)

The key used for inline text entries inside the children array when a node has mixed content (text interleaved with child elements).

```js
new SequentialBuilderFactory({
  nameFor: { text: ":text" }
})
```

### `nameFor.comment`

When `skip.comment` is false, this property name is used for comment entries in the children array.

```js
new SequentialBuilderFactory({
  nameFor: { comment: "#comment" }
})
```

### `nameFor.cdata`

When set, CDATA sections appear as `{ [cdata]: value }` entries in the children array. When unset (default), CDATA content is merged into the node's `text` value (same as regular text).

```js
// builder config
const builderConfig = { nameFor: { cdata: "##cdata" } };
// parser config
const parserConfig  = { skip: { cdata: false } };

const parser = new XMLParser({
  OutputBuilder: new SequentialBuilderFactory(builderConfig),
  ...parserConfig,
});
```

Output for `<root><code><![CDATA[data]]></code></root>`:
```js
[
  {
    root: [
      {
        code: [
          { "##cdata": "data" }
        ]
      }
    ]
  }
]
```

### `textInChild` (default: `false`)

When `true`, text is always stored as a `{ [nameFor.text]: value }` entry in the children array — even on pure leaf nodes that have no element children. The `text` sibling property is never set in this mode.

```js
new SequentialBuilderFactory({ textInChild: true })
```

Input:
```xml
<root><a>hello</a></root>
```

Default output (`textInChild: false`):
```js
[ { root: [ { a: [], text: "hello" } ] } ]
```

Output with `textInChild: true`:
```js
[ { root: [ { a: [ { "#text": "hello" } ] } ] } ]
```

### `skip.attributes` (default: `true`)

When `true` (default), all attributes are ignored and no `attributes` property appears on entries. Set to `false` to populate attributes.

### Value parsers

By default the parser chain `["entity", "boolean", "number"]` is applied to text content, converting `"42"` → `42` and `"true"` → `true`. Override with `tags.valueParsers`.

```js
new SequentialBuilderFactory({
  tags: { valueParsers: [] }   // keep all values as raw strings
})
```
