# Compact Output Builder

This helps to generate compact or minimal JS Object from XML.

## Installation

```bash
npm install @nodable/compact-builder
```

## Usage

```javascript
import XMLParser from "@nodable/flexible-xml-parser";
import CompactBuilder from "@nodable/compact-builder";

const parser = new XMLParser({
  OutputBuilder: new CompactBuilder()
});

const result = parser.parse('<root><item>value</item></root>');
```

## Properties

### 1. `forceArray` Option

**Type:** `function(matcher, isLeafNode) => boolean`

Forces specific XML tags to always be represented as arrays, even when only a single occurrence exists. This ensures consistent data structures in your parsed output.

**Key Benefits:**

- Prevents code breaking when XML structure changes (single → multiple elements)
- Simplifies array processing logic in consuming code
- Supports path-based, attribute-based, and leaf-node-based decisions

```js
import XMLParser from "@nodable/flexible-xml-parser"
import CompactBuilder from "@nodable/compact-builder"

const inputXml = `<catalog><book>Title</book></catalog>`;

const parser = new XMLParser({
  OutputBuilder: new CompactBuilder({
    forceArray: (matcher, isLeafNode) => {
      return matcher.path.endsWith('catalog.book');
    }
  }),
});

const result = parser.parse(inputXml);
```

Output
```json
{
  "catalog": {
    "book": [
      {
        "title": "Title"
      }
    ]
  }
}
```

### 2. `alwaysArray` Option

**Type:** `string[] | Expression[]`

Forces specific XML tags to always be represented as arrays, even when only a single occurrence exists. This ensures consistent data structures in your parsed output.

**Key Benefits:**

- Prevents code breaking when XML structure changes (single → multiple elements)
- Simplifies array processing logic in consuming code
- Supports path-based, attribute-based, and leaf-node-based decisions

```js
const inputXml = `<catalog><book>Title</book></catalog>`;

const parser = new XMLParser({
  OutputBuilder: new CompactBuilder({
    alwaysArray: ["..item", new Expression('root.product')]
  }),
});

const result = parser.parse(inputXml);
```

Output
```json
{
  "catalog": {
    "book": [
      {
        "title": "Title"
      }
    ]
  }
}
```

Please note that if `alwaysArray` or `forceArray` returns true for a tag then it'll be array. Similarly if any one of then returns false for a tag then it'll not be array.

### 3. `forceTextNode` Option

**Type:** `boolean`

Forces creation of a text node object for every tag, ensuring consistent object structure instead of mixing strings and objects.

**Key Benefits:**

- Uniform property access patterns (`item["#text"]` always works)
- Easier to serialize/deserialize
- Consistent structure across all tags


```js
const inputXml = `<item>Value</item>`;

const parser = new XMLParser({
  OutputBuilder: new CompactBuilder({
    forceTextNode: true //false by default
  }),
});

const result = parser.parse(inputXml);

// Without option: { item: "Value" }
// With option: { item: { "#text": "Value" } }
```

Output
```js
{ item: { "#text": "Value" } }
```