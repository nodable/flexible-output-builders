# Base Output Builder

Base output builder is the base class to create output builders for @nodable/flexible-xml-parser.

## Installation

```bash
npm install @nodable/base-output-builder
```

## Usage

```javascript
import { BaseOutputBuilder, commonValueParsers } from '@nodable/base-output-builder';

class MyOutputBuilder extends BaseOutputBuilder {
  constructor(options) {
    super(options);
  }
}

class MyBuilder extends BaseOutputBuilder {
  constructor(options, builderOptions, valParsers, matcher) {
    super(readonlyMatcher);
    this.options = {
      ...builderOptions,
      ...parserOptions,
      //my builder specific options
    }
  }
  // override addTag, addAttribute, closeTag, addValue ... methods
}

// 2. Wrap it in a factory object that XMLParser knows how to call
const MyBuilderFactory = {
  constructor(builderOptions) {
    this.options = buildOptions(builderOptions);
    this.valParsers = commonValueParsers();
  }

  registerValueParser(name, parser) {
    // implement if you need to register named value parsers on this factory
    this.valParsers[name] = parserInstance;
  },

  getInstance(parserOptions, matcher) {
    return new MyBuilder(parserOptions, this.options, this.valParsers, matcher);
  },
};

```

You can also modify the bhaviour of value parsers bundled with base-output-builder by passing options.

```js
import { numberParser } from '@nodable/base-output-builder';
import { XmlParser } from '@nodable/flexible-xml-parser';

const numberParserInstance = new numberParser({ hex: true, leadingZeros: true, eNotation: true });

const myBuilderFactory = new MyBuilderFactory({
  tags: {
    valParsers: ['entity', 'number', 'boolean', 'trim', 'currency']
  },
  attributes: {
    valParsers: ['entity', 'number', 'boolean', 'trim', 'currency']
  }
});
myBuilderFactory.registerValueParser('number', numberParserInstance); //overrides default settings

const parser = new XmlParser({
  OutputBuilder: myBuilderFactory
});

```

This package provides following value parsers

- number: This uses [strnum](https://www.npmjs.com/package/strnum) package to parser strings in number
- boolean: This parses boolean strings in boolean values
- trim: trim the input string
- joint: join the input string
- currency: parse currency
- Entity: parse entities


### Entity Parser

Entity Parser is used to parse entities in the input string. There are total 4 types of entities.

Category 1
1. **Default** : Entities which are natively supported by XML. apos, lt, gt, quot are supported.
2. **SYSTEM**: System specific entites like HTML. When set space, cent, pound, yen, euro, copy, reg, inr, numeric, and hexadecimal entites are supported.

Category 2
3. **INPUT**: Input specific entites. These entities are provided by the user as input to the parser. Parser reads these entites and pass to output builder using the method `addInputEntities`.
4. **EXTERNAL**: These entities are set by programmaer in code. These are recommended over INPUT entities for security reasons. 

```js
import { EntitiesValueParser } from "@nodable/base-output-builder"

const evp = new EntitiesValueParser({
  docType: true
});
const builder = new CompactObjBuilder();
builder.registerValueParser("entity", evp);

const parser = new XMLParser({
  doctypeOptions: { enabled: true },
  OutputBuilder: builder
});
const result = parser.parse(`<!DOCTYPE root [
  <!ENTITY brand "FlexParser">
]><root><name>&brand;</name></root>`);
```

Following options are supported

- **default**: true/false/object. Default is true. If true, XML entities are parsed. If false, XML entities are not parsed. If object, custom XML entities are parsed.
- **html**: true/false/object. Default is false. If true, HTML entities are parsed. If false, HTML entities are not parsed. If object, custom HTML entities are parsed.
- **external**: true/false. Default is true. If true, external entities are parsed. If false, external entities are not parsed.
```js
const evpOn = new EntitiesValueParser({ default: true, external: true });
    evpOn.addEntity("copy", "©");
```
- **maxTotalExpansions**: number. Default is 0. Maximum number of entity expansions allowed per document.
- **maxExpandedLength**: number. Default is 0. Maximum number of characters added by entity expansion per document.
