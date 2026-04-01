# Sequential Output Builder

This helps to generate the sequential response.

Input
```xml
<root>
  <child>hello</child>
  <child>world</child>
</root>
```

Output
```js
```js
[
  {
    "root": [
      {
        "child": [
          {
            "#text": "hello"
          }
        ]
      },
      {
        "child": [
          {
            "#text": "world"
          }
        ]
      }
    ]
  }
]
```

## Install

```bash
npm install @solothought/sequential-builder
```