# Compact Output Builder

This package provides two output builders for `@solothought/flexible-xml-parser`:

- **`CompactBuilderFactory`** — builds a compact in-memory JS object from XML (original)
- **`CompactStreamBuilderFactory`** — streams JSON fragments to a callback or writable stream as parsing progresses, keeping memory usage low

## Installation

```bash
npm install @solothought/compact-builder
```

---

## CompactBuilder

Parses the entire XML document and returns a compact JS object.

```javascript
import XMLParser from "@solothought/flexible-xml-parser";
import { CompactBuilderFactory } from "@solothought/compact-builder";

const parser = new XMLParser({
  OutputBuilder: new CompactBuilderFactory()
});

const result = parser.parse('<root><item>value</item></root>');
// result → { root: { item: "value" } }
```

---

## CompactStreamBuilder

Emits JSON text fragments progressively as each tag is closed, instead of accumulating everything in memory. Useful for large XML documents or when you want to pipe output to a file or HTTP response.

### Basic usage with a callback

```javascript
import XMLParser from "@solothought/flexible-xml-parser";
import { CompactStreamBuilderFactory } from "@solothought/compact-builder";

let json = '';
const parser = new XMLParser({
  OutputBuilder: new CompactStreamBuilderFactory({
    onChunk: (chunk) => { json += chunk; }
  })
});

parser.parse('<root><item>value</item></root>');
// json → '{"root":{"item":"value"}}'
```

### Writing to a file stream

```javascript
import fs from 'fs';
import XMLParser from "@solothought/flexible-xml-parser";
import { CompactStreamBuilderFactory } from "@solothought/compact-stream-builder";

const out = fs.createWriteStream('output.json');

const parser = new XMLParser({
  OutputBuilder: new CompactStreamBuilderFactory({ stream: out })
});

parser.parse(xmlString);
out.end();
```

### How streaming works

The builder emits JSON fragments to your callback as soon as each tag's value is
fully determined. Because JSON does not allow repeated keys, the builder buffers
one sibling at a time and automatically promotes it to an array if a second sibling
with the same tag name appears — no upfront array declarations needed.

```xml
<orders>
  <item>Widget</item>
  <item>Gadget</item>
</orders>
```

Emitted chunks (in order):
```
{                          ← orders object opens
"item":["Widget","Gadget"  ← promoted to array on second <item>
]                          ← array closed when orders closes
}                          ← orders closes
```

Final JSON: `{"orders":{"item":["Widget","Gadget"]}}`

### Differences from CompactBuilder

| Feature | CompactBuilder | CompactStreamBuilder |
|---|---|---|
| Output | `getOutput()` returns JS object | `getOutput()` returns `null`; use `onChunk`/`stream` |
| Memory | Full tree in memory | One sibling buffered per depth level |
| `onTagClose` option | ✅ Supported | ❌ Not supported (can't retract emitted output) |
| Repeated siblings → array | Automatic | Automatic (via one-sibling buffer) |
| `alwaysArray` / `forceArray` | ✅ | ✅ (skips buffering, opens array immediately) |
| `forceTextNode` | ✅ | ✅ |

---

## Shared options

Both builders accept the same base options.

### `forceArray`

**Type:** `function(matcher, isLeafNode) => boolean`

Forces specific tags to always be represented as arrays even when only one occurrence exists.

```js
new CompactBuilderFactory({
  forceArray: (matcher, isLeafNode) => matcher.toString().endsWith('catalog.book')
})
```

### `alwaysArray`

**Type:** `string[] | Expression[]`

Declarative alternative to `forceArray`. Any matching tag is always an array.

```js
new CompactBuilderFactory({
  alwaysArray: ["..item", new Expression('root.product')]
})
```

If `alwaysArray` or `forceArray` returns `true` for a tag it will be an array.
If either returns `false` it will not be an array, regardless of the other.

### `forceTextNode`

**Type:** `boolean` — Default: `false`

Forces every tag to be represented as an object with a `#text` property, ensuring
uniform structure even for tags that only contain text.

```js
const inputXml = `<item>Value</item>`;

new CompactBuilderFactory({ forceTextNode: true })
// Without: { item: "Value" }
// With:    { item: { "#text": "Value" } }
```