# Node Tree Output Builder

Produces a sequential node tree where each element has three fixed properties — `tagname`, `child`, and `attributes` — plus an optional `text` property for leaf nodes.

## Node structure

```
{
  tagname: string,      // element name
  child: array,         // ordered child nodes (always present, empty for leaf nodes)
  attributes: object,   // always present; populated when skip.attributes is false
  text?: any            // only present on leaf nodes (no child elements)
}
```

### Leaf node (text only, no child elements)

```js
{ tagname: "span", child: [], attributes: {}, text: "Hello" }
```

### Empty tag (no text, no children)

```js
{ tagname: "br", child: [], attributes: {} }
```

### Tag with child elements

```js
{ tagname: "div", child: [ /* child nodes */ ], attributes: {} }
```

### Mixed content (text interleaved with child elements)

Inline text runs appear as `{ ":text": value }` entries inside the `child` array. The parent node has no `text` property in this case.

Input:
```xml
<p>Hello <b>world</b>!</p>
```

Output:
```js
{
  tagname: "p",
  child: [
    { ":text": "Hello " },
    { tagname: "b", child: [], attributes: {}, text: "world" },
    { ":text": "!" }
  ],
  attributes: {}
}
```

#### textInChild

However, if `textInChild` is set to `true` then text is always inserted in child.


Input:
```xml
<p>Hello <b>world</b>!</p>
```

Output:
```js
{
  tagname: "p",
  child: [
    { ":text": "Hello " },
    { tagname: "b", child: [
      { ":text": "world" }
      ], attributes: {}},
    { ":text": "!" }
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
  tagname: "root",
  child: [
    { tagname: "child", child: [], attributes: {}, text: "hello" },
    { tagname: "child", child: [], attributes: {}, text: "world" }
  ],
  attributes: {}
}
```

The fixed structure lets you traverse the tree without defensive property checks.

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

## Options

### `attributes.groupBy` (default: `"attributes"`)

The property name under which all attributes are collected. The property is **always** present on every node, even when empty.

```js
new NodeTreeBuilderFactory({
  attributes: { groupBy: "attributes" }  // default
})
```

To use a custom key:

```js
new NodeTreeBuilderFactory({
  attributes: { groupBy: ":@" }
})
```

### `nameFor.text` (default: `"#text"`)

The key used for inline text entries inside `child` when a node has mixed content.

```js
new NodeTreeBuilderFactory({
  nameFor: { text: ":text" }
})
```

### `nameFor.comment`

When skip.comment is false, this property is used to name the comment nodes.


### `nameFor.cdata` (default: `""`)

input: 
```xml
<root><code><![CDATA[data]]></code></root>
```

```js
const builderConfig = { nameFor: { cdata: "##cdata" } }
const parserConfig =  { skip: { cdata: false } }

const parser = new XMLParser({
  OutputBuilder: new NodeTreeBuilderFactory(builderConfig),
  ...parserConfig,
});

const result = parser.parse(xmlString);
```

Output
```js
 {
        "tagname": "root",
        "child": [
          {
            "tagname": "code",
            "child": [
              {
                "tagname": "##cdata",
                "child": [],
                "attributes": {},
                "text": "data"
              }
            ],
            "attributes": {}
          }
        ],
        "attributes": {}
      }
```

### `skip.attributes` (default: `true`)

When `true` (default), all attributes are ignored and every node's `attributes` property is `{}`. Set to `false` to populate attributes.

### Value parsers

By default the parser chain `["entity", "boolean", "number"]` is applied to text content, converting strings like `"42"` to `42` and `"true"` to `true`. Override with `tags.valueParsers`.