# Node Tree Output Builder

Produces a node tree where each element has three fixed properties — `elementname`, `child`, and `[groupBy]` — plus an optional `text` property for leaf nodes.

## Install

```bash
npm install @nodable/node-tree-builder
```

## Usage

```js
import XMLParser from "@nodable/flexible-xml-parser";
import NodeTreeBuilderFactory from "@nodable/node-tree-builder";

const parser = new XMLParser({
  OutputBuilder: new NodeTreeBuilderFactory(builderOptions),
  ...parserOptions,
});

const result = parser.parse(xmlString);
```

## Node structure

```
{
  elementname: string,  // element name
  child: array,         // ordered child nodes (always present, empty for leaf nodes)
  [groupBy]: object,    // attributes (always present; key defaults to "attributes")
  text?: any            // only present on leaf nodes (no child elements)
}
```

### Leaf node (text only, no child elements)

```js
{ elementname: "span", child: [], attributes: {}, text: "Hello" }
```

### Empty tag (no text, no children)

```js
{ elementname: "br", child: [], attributes: {} }
```

### Tag with child elements

```js
{ elementname: "div", child: [ /* child nodes */ ], attributes: {} }
```

### Mixed content (text interleaved with child elements)

Inline text runs appear as `{ "#text": value }` entries inside the `child` array. The parent node has no `text` property in this case.

Input:
```xml
<p>Hello <b>world</b>!</p>
```

Output:
```js
{
  elementname: "p",
  child: [
    { "#text": "Hello " },
    { elementname: "b", child: [], attributes: {}, text: "world" },
    { "#text": "!" }
  ],
  attributes: {}
}
```

### `textInChild`

When `textInChild: true`, text is always stored as a `{ [nameFor.text]: value }` child entry — even on pure leaf nodes. The `text` property is never set in this mode.

Input:
```xml
<p>Hello <b>world</b>!</p>
```

Output:
```js
{
  elementname: "p",
  child: [
    { "#text": "Hello " },
    { elementname: "b", child: [ { "#text": "world" } ], attributes: {} },
    { "#text": "!" }
  ],
  attributes: {}
}
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
{
  elementname: "root",
  child: [
    { elementname: "child", child: [], attributes: {}, text: "hello" },
    { elementname: "child", child: [], attributes: {}, text: "world" }
  ],
  attributes: {}
}
```

The fixed structure lets you traverse the tree without defensive property checks.

---

## Options

> **Parser-level options** (`skip`, `nameFor`, `attributes.groupBy`, `attributes.prefix`,
> `attributes.suffix`) are configured on the XML parser, not the builder factory.
> See the `@nodable/flexible-xml-parser` documentation for those options.

### `textInChild` (default: `false`)

When `true`, text is always stored as a `{ [nameFor.text]: value }` child entry — even on pure leaf nodes. See the example above.

```js
new NodeTreeBuilderFactory({ textInChild: true })
```

### `tags.valueParsers`

Value parser chain applied to tag text content. Default: `['ws', 'entity', 'boolean', 'number']`.

```js
new NodeTreeBuilderFactory({
  tags: { valueParsers: [] }  // keep all values as raw strings
})
```

### `attributes.valueParsers`

Value parser chain applied to attribute values. Default: `['entity', 'number', 'boolean']`.

### `onClose`

Called when any tag closes, before its node is pushed to the parent's `child` array. Return a truthy value to drop the node from output entirely.

```js
new NodeTreeBuilderFactory({
  onClose: (node, matcher) => {
    if (node.elementname === 'internal') return true; // drop
  }
})
```

The `node` argument has `elementname`, `child`, `text`, and the attributes groupBy key fully populated at call time.