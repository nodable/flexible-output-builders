# Output Builders

A collection of customizable output builders for [flexible-xml-parser](https://github.com/nodable /flexible-xml-parser). These builders allow you to transform XML into various JavaScript data structures and formats.

## Architecture

The Flexible XML Parser uses a modular architecture with four key components:

1. **Input Sources** - Handle different XML input types (string, buffer, stream, feed)
2. **Core Parser** - Parses XML into an in-memory object representation
3. **Output Builders** - Transform the parsed data into desired formats (this repository)
4. **Value Parsers** - Transform individual values (numbers, booleans, entities, etc.)

Output builders are generic enough to be used by other parsers that expect the same API, making them a standalone, reusable package collection.

## Packages

This monorepo contains the following packages:

### [@nodable/base-output-builder](./base-output-builder)

The foundation for all output builders. Provides:
- Base `BaseOutputBuilder` class for creating custom builders
- Common value parsers (number, boolean, trim, currency, entity)
- Entity parsing with security limits
- Extensible architecture for custom transformations

**Use when:** Building a custom output format or extending existing builders

### [@nodable/compact-builder](./compact-builder)

Generates compact, minimal JavaScript objects from XML.

**Features:**
- Minimal object structure
- `forceArray` - Control which elements are always arrays
- `alwaysArray` - Path-based array forcing
- `forceTextNode` - Consistent text node structure

**Use when:** You need clean, minimal JSON-like objects

### [@nodable/sequential-builder](./SequentialBuilder)

Generates sequential array-based representation of XML.

**Features:**
- Array-based structure preserving document order
- All elements as array entries
- Maintains element sequence

**Use when:** Order of elements is critical or you need to process XML sequentially

### [@nodable/sequential-stream-builder](./SequentialStreamBuilder)

Generates sequential array-based representation of XML but on the stream.

**Features:**
- Array-based structure preserving document order
- All elements as array entries
- Maintains element sequence

**Use when:** 
- Order of elements is critical or you need to process XML sequentially
- You are processing large XML files and need to process them on the stream

### [@nodable/node-tree-builder](./NodeTreeBuilder)

Generates a fixed-structure tree where each node has `tagname` and `child` properties.

**Features:**
- Consistent node structure
- Easy tree traversal
- Predictable property access
- No conditional checks needed

**Use when:** You need a uniform tree structure for traversal algorithms

## Quick Start

### Installation

Install the output builder you need:

```bash
# For compact objects
npm install @nodable/compact-builder

# For sequential arrays
npm install @nodable/sequential-builder

# For sequential stream arrays
npm install @nodable/sequential-stream-builder

# For fixed-structure trees
npm install @nodable/node-tree-builder

# For custom builders
npm install @nodable/base-output-builder
```

### Basic Usage

```javascript
import XMLParser from "@nodable/flexible-xml-parser";
import CompactBuilder from "@nodable/compact-builder";

const xml = `
  <catalog>
    <book id="1">
      <title>XML Basics</title>
      <author>John Doe</author>
    </book>
  </catalog>
`;

const parser = new XMLParser({
  OutputBuilder: new CompactBuilder()
});

const result = parser.parse(xml);
console.log(result);
```

### Creating Custom Builders

```javascript
import { BaseOutputBuilder, commonValueParsers } from '@nodable/base-output-builder';

class MyCustomBuilder extends BaseOutputBuilder {
  constructor(parserOptions, builderOptions, valParsers, matcher) {
    super(matcher);
    this.registeredValParsers = valParsers;
    this.options = { ...builderOptions, ...parserOptions };
    // Initialize your custom data structure
  }

  addElement(tag, matcher) {
    // Handle opening tag
  }

  closeElement(matcher) {
    // Handle closing tag
  }

  addValue(text, matcher) {
    // Handle text content
  }

  getOutput() {
    // Return final output
    return this.result;
  }
}

// Create a factory
const MyBuilderFactory = {
  constructor(builderOptions) {
    this.options = builderOptions;
    this.valParsers = commonValueParsers();
  },

  registerValueParser(name, parser) {
    this.valParsers[name] = parser;
  },

  getInstance(parserOptions, matcher) {
    return new MyCustomBuilder(parserOptions, this.options, this.valParsers, matcher);
  }
};
```

## Value Parsers

All builders include these value parsers:

- **number** - Converts strings to numbers (using [strnum](https://www.npmjs.com/package/strnum))
- **boolean** - Parses boolean strings ("true"/"false")
- **trim** - Trims whitespace
- **currency** - Parses currency values
- **entity** - Resolves XML/HTML entities with security limits
- **join** - Joins array values into strings

### Customizing Value Parsers

```javascript
import { numberParser } from '@nodable/base-output-builder';

const customNumber = new numberParser({ 
  hex: true, 
  leadingZeros: true, 
  eNotation: true 
});

const builder = new CompactBuilder();
builder.registerValueParser('number', customNumber);
```

## Entity Parsing

The entity parser supports four types of entities:

1. **Default (XML)** - Built-in XML entities (lt, gt, apos, quot, amp)
2. **HTML** - HTML named entities and numeric references
3. **DOCTYPE** - Entities defined in DOCTYPE declarations
4. **External** - Programmatically registered entities

```javascript
import { EntitiesValueParser } from "@nodable/base-output-builder";

const entityParser = new EntitiesValueParser({
  default: true,          // Enable XML entities
  html: false,            // Disable HTML entities
  external: true,         // Enable external entities
  maxTotalExpansions: 1000,     // Security limit
  maxExpandedLength: 10000      // Security limit
});

entityParser.addEntity('copy', '©');
entityParser.addEntity('brand', 'MyCompany');
```

## Builder Comparison

| Feature | Compact | Sequential | NodeTree |
|---------|---------|------------|----------|
| Object structure | Nested objects | Arrays | Fixed tree |
| Element order | Not preserved | Preserved | Preserved |
| Array control | Yes | N/A | N/A |
| Text node control | Yes | No | No |
| Traversal ease | Medium | Easy | Very Easy |
| Output size | Smallest | Large | Medium |

## Examples

See individual package READMEs for detailed examples:
- [Compact Builder Examples](./compact-builder/README.md)
- [Sequential Builder Examples](./SequentialBuilder/README.md)
- [Node Tree Builder Examples](./NodeTreeBuilder/README.md)
- [Base Builder Examples](./base-output-builder/README.md)

## Development

This is a monorepo using npm workspaces.

```bash
# Install all dependencies
npm install

# Install for all workspaces
npm run install:all

# Run tests for all packages
npm test
```

## Contributing

Contributions are welcome! Please ensure:
1. All packages maintain backward compatibility
2. TypeScript definitions are updated
3. Documentation is clear and complete
4. Tests pass for all packages

## License

MIT © [Amit Gupta](https://nodable.com)

## Links

- [Flexible XML Parser](https://github.com/nodable/flexible-xml-parser)
- [Documentation](https://github.com/nodable/flex-output-builders#readme)
- [Issues](https://github.com/nodable/flex-output-builders/issues)

## Author

**Amit Gupta**
- Website: [nodable.com](https://nodable.com)
- GitHub: [@nodable](https://github.com/nodable)
