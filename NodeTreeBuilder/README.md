# Node Tree Output Builder

This helps to generate the sequential response where each item has 2 fixed propertes.

- tagname: string
- child: array of objects


Input
```xml
<root>
  <child>hello</child>
  <child>world</child>
</root>
```

Output
```js
{
  "tagname": "root",
  "child": [
    {
      "tagname": "child",
      "child": [
        {
          "#text": "hello"
        }
      ]
    },
    {
      "tagname": "child",
      "child": [
        {
          "#text": "world"
        }
      ]
    }
  ]
}
```

This fixed structure helps you to traverse without adding conditions.

Additionally, each item can have extra properties based on the input XML attributes. Attributes are always grouped.

## Install

```bash
npm install @solothought/node-tree-builder
```