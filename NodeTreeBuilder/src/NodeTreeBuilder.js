//OrderedOutputBuilder

import { buildOptions } from './ParserOptionsBuilder.js';
import { BaseOutputBuilder, BaseOutputBuilderFactory, commonValueParsers, ElementType } from '@nodable/base-output-builder';

const rootName = '!js_arr';

export default class NodeTreeBuilderFactory extends BaseOutputBuilderFactory {
  constructor(options) {
    super()
    this.options = buildOptions(options);
    // this.commonValParsers = commonValueParsers();
  }

  // registerValueParser(name, parserInstance) {
  //   this.commonValParsers[name] = parserInstance;
  // }

  getInstance(parserOptions, readonlyMatcher) {
    this.resetValParsers();
    const valParsers = { ...this.commonValParsers };
    return new NodeTreeBuilder(parserOptions, this.options, valParsers, readonlyMatcher);
  }
}

export class NodeTreeBuilder extends BaseOutputBuilder {

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
    // retroactively migrate it into the child array as an inline text entry
    // now that we know this is mixed content.
    if (this.currentNode.text !== undefined) {
      this.currentNode.child.unshift({
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

    this.currentNode.child.push(node);
  }

  _addChild(node) {
    // this.currentNode.child.push({ [key]: val });
    this.currentNode.child.push(node);
  }

  addValue(text) {
    const tagName = this.currentNode?.elementname;
    // Check whether there are already element children (mixed content scenario)
    const hasElementChildren = this.currentNode?.child?.some(c => c.elementname !== undefined);

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
      this.currentNode.child.push({
        [this.options.nameFor.text]: parsedValue
      });
    } else {
      // Pure text (leaf node or text before any child elements):
      // set directly on the node as `text` property
      this.currentNode.text = parsedValue;
    }
  }

  addInstruction(name) {
    const node = new Node(name, this.options);
    if (!isEmpty(this.attributes)) {
      node[this.options.attributes.groupBy] = this.attributes;
    }
    // this.currentNode.child.push(node);
    this._addChild(node);
    this.attributes = {};
  }

  addComment(text) {
    if (this.options.skip.comment) return;
    if (this.options.nameFor.comment) {
      const node = new Node(this.options.nameFor.comment, this.options);
      node.text = text;
      this._addChild(node);
    }
  }

  addLiteral(text) {
    if (this.options.skip.cdata) return;
    if (this.options.nameFor.cdata) {
      const node = new Node(this.options.nameFor.cdata, this.options);
      node.text = text;
      this._addChild(node);
    } else {
      this.addValue(text || "");
    }
  }

  getOutput() {
    const children = this.root.child;
    if (children.length === 1) return children[0];
    return children;
  }
}

class Node {
  constructor(elementname, options) {
    this.elementname = elementname;
    this.child = [];
    const groupBy = options?.attributes?.groupBy ?? 'attributes';
    this[groupBy] = {};
  }
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}