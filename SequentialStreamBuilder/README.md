# Sequential Stream Output Builder

Stream variant of the Sequential Output Builder. Instead of accumulating the full parse result in memory, each top-level XML element is serialised to JSON and emitted to a Writable stream (or callback) as soon as its closing tag is processed.

## Install

```bash
npm install @nodable/sequential-stream-builder
```

## Usage

```js
import XMLParser from "@nodable/flexible-xml-parser";
import {SequentialStreamBuilderFactory} from "@nodable/sequential-stream-builder";

const parser = new XMLParser({
  OutputBuilder: new SequentialStreamBuilderFactory({
    stream: fs.createWriteStream('output.json'),
    // onChunk: (chunk) => {
    //   console.log('CHUNK EMITTED:', chunk);
    // }
  }),
  ...parserOptions,
});

parser.parse(xmlString);
// result is always an array in form of stream
```

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

## Options

> **Parser-level options** (`skip`, `nameFor`, `attributes.groupBy`, `attributes.prefix`,
> `attributes.suffix`) are configured on the XML parser, not the builder factory.
> See the `@nodable/flexible-xml-parser` documentation for those options.

### `stream`

A Node.js Writable stream. JSON chunks are written via `stream.write()` as each top-level element closes.

Mutually exclusive with `onChunk`. Exactly one must be provided.

```js
import fs from 'node:fs';

const out = fs.createWriteStream('output.json');
out.on('open', () => {
  const parser = new XMLParser({
    OutputBuilder: new SequentialStreamBuilderFactory({ stream: out }),
  });
  parser.parse(xmlString);
  out.end();
});
```

### `onChunk`

Callback invoked with each string chunk. Use when you don't have a Writable — e.g. to accumulate into a buffer or send over a WebSocket.

Mutually exclusive with `stream`. Exactly one must be provided.

```js
const chunks = [];
const parser = new XMLParser({
  OutputBuilder: new SequentialStreamBuilderFactory({
    onChunk: (chunk) => chunks.push(chunk),
  }),
});
parser.parse(xmlString);
const json = chunks.join('');
```

### `space`

Spacing argument forwarded to `JSON.stringify()`. Omit for compact output; pass `2` for human-readable indented output.

```js
new SequentialStreamBuilderFactory({ stream: out, space: 2 })
```

### `textInChild` (default: `false`)

When `true`, text is always stored as a `{ [nameFor.text]: value }` entry in the children array — even on pure leaf nodes that have no element children. The `text` sibling property is never set in this mode.

```js
new SequentialStreamBuilderFactory({ textInChild: true })
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

### Value parsers

By default the parser chain `["ws", "entity", "boolean", "number"]` is applied to text content, converting `"42"` → `42` and `"true"` → `true`. Override with `tags.valueParsers`.

```js
new SequentialStreamBuilderFactory({
  tags: { valueParsers: [] }   // keep all values as raw strings
})
```

### `onClose`

Called when any tag closes, before its entry is pushed to the parent's children array. Return a truthy value to drop the tag from output entirely.

```js
new SequentialStreamBuilderFactory({
  stream: out,
  onClose: (node, matcher) => {
    if (node.tagname === 'internal') return true; // drop
  },
})
```