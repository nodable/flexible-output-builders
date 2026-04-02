import { buildOptions } from './ParserOptionsBuilder.js';
import { BaseOutputBuilder, BaseOutputBuilderFactory, ElementType } from '@solothought/base-output-builder';

const rootName = '!sequential_root';

export default class SequentialBuilderFactory extends BaseOutputBuilderFactory {
  constructor(options) {
    super();
    this.options = buildOptions(options);
  }

  getInstance(parserOptions, readonlyMatcher) {
    const valParsers = { ...this.commonValParsers };
    return new SequentialBuilder(parserOptions, this.options, valParsers, readonlyMatcher);
  }
}

export class SequentialBuilder extends BaseOutputBuilder {

  constructor(parserOptions, builderOptions, registeredValParsers, readonlyMatcher) {
    super(readonlyMatcher);
    this.tagsStack = [];
    this.parserOptions = parserOptions;

    this.options = {
      ...parserOptions,
      ...builderOptions,
      skip: { ...parserOptions.skip, ...builderOptions.skip },
      nameFor: { ...parserOptions.nameFor, ...builderOptions.nameFor },
      tags: { ...parserOptions.tags, ...builderOptions.tags },
      attributes: { ...parserOptions.attributes, ...builderOptions.attributes },
    };

    this.registeredValParsers = registeredValParsers;

    this.root = new Node(rootName, this.options);
    this.currentNode = this.root;
    this.attributes = {};
    this._pendingStopNode = false;
  }

  addElement(tag) {
    // If the current node has text set (text arrived before any child element),
    // retroactively migrate it into the children array as an inline text entry
    // now that we know this is mixed content.
    if (this.currentNode.text !== undefined) {
      this.currentNode.children.unshift({
        [this.options.nameFor.text]: this.currentNode.text
      });
      delete this.currentNode.text;
    }

    this.tagsStack.push(this.currentNode);
    const node = new Node(tag.name, this.options);
    // Attach any pending attributes onto the new node
    if (this.attributes && Object.keys(this.attributes).length > 0) {
      node[this.options.attributes.groupBy] = { ...this.attributes };
    }
    this.attributes = {};
    this.currentNode = node;
  }

  /**
   * Called when a stop node is fully collected, before `addValue`.
   *
   * @param {TagDetail}       tagDetail  - name, line, col, index of the stop node
   * @param {string}          rawContent - raw unparsed content between the tags
   */
  onStopNode(tagDetail, rawContent) {
    this._pendingStopNode = true;
    if (typeof this.options.onStopNode === 'function') {
      this.options.onStopNode(tagDetail, rawContent, this.matcher);
    }
  }

  closeElement() {
    const node = this.currentNode;
    this.currentNode = this.tagsStack.pop();

    this._pendingStopNode = false;

    if (this.options.onClose !== undefined) {
      const resultTag = this.options.onClose(node, this.matcher);
      if (resultTag) return;
    }

    // Build the sequential representation:
    // { [tagName]: children, [groupBy]: attributes, text? }
    // Tag name directly points to the children array.
    // Attributes (when present) are a sibling property alongside the tag key.
    const entry = { [node.tagname]: node.children };

    const groupBy = this.options.attributes.groupBy;
    if (node[groupBy] && Object.keys(node[groupBy]).length > 0) {
      entry[groupBy] = node[groupBy];
    }

    // text is a sibling property (leaf-node case — no element children)
    if (node.text !== undefined) {
      entry.text = node.text;
    }

    this.currentNode.children.push(entry);
  }

  addValue(text) {
    const tagName = this.currentNode?.tagname;
    // Check whether there are already element children (mixed content scenario).
    // Mixed content = children that are NOT bare text entries.
    const hasElementChildren = this.currentNode?.children?.some(
      c => !Object.prototype.hasOwnProperty.call(c, this.options.nameFor.text)
    );

    const context = {
      elementName: tagName,
      elementValue: text,
      elementType: ElementType.ELEMENT,
      matcher: this.matcher,
      isLeafNode: !hasElementChildren,
    };

    const parsedValue = this.parseValue(text, this.options.tags.valueParsers, context);

    if (hasElementChildren || this.options.textInChild) {
      // Mixed content: text alongside child elements — store as inline text child
      this.currentNode.children.push({
        [this.options.nameFor.text]: parsedValue
      });
    } else {
      // Pure text (leaf node or text before any child elements):
      // set directly on the node; promoted to sibling property in closeElement.
      this.currentNode.text = parsedValue;
    }
  }

  addInstruction(name) {
    const node = new Node(name, this.options);
    const groupBy = this.options.attributes.groupBy;
    if (this.attributes && Object.keys(this.attributes).length > 0) {
      node[groupBy] = { ...this.attributes };
    }
    const entry = { [node.tagname]: node.children };
    if (node[groupBy] && Object.keys(node[groupBy]).length > 0) {
      entry[groupBy] = node[groupBy];
    }
    this.currentNode.children.push(entry);
    this.attributes = {};
  }

  addComment(text) {
    if (this.options.skip.comment) return;
    if (this.options.nameFor.comment) {
      this.currentNode.children.push({
        [this.options.nameFor.comment]: text
      });
    }
  }

  addLiteral(text) {
    if (this.options.skip.cdata) return;
    if (this.options.nameFor.cdata) {
      this.currentNode.children.push({
        [this.options.nameFor.cdata]: text
      });
    } else {
      this.addValue(text || '');
    }
  }

  getOutput() {
    return this.root.children;
  }
}

class Node {
  constructor(tagname, options) {
    this.tagname = tagname;
    this.children = [];
    const groupBy = options?.attributes?.groupBy ?? 'attributes';
    this[groupBy] = {};
  }
}
