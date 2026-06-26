//OrderedOutputBuilder

import { buildOptions } from './ParserOptionsBuilder.js';
import { BaseOutputBuilder, BaseOutputBuilderFactory, Context } from '@nodable/base-output-builder';


export default class NodeTreeBuilderFactory extends BaseOutputBuilderFactory {
  constructor(options) {
    super();
    this.builderOptions = buildOptions(options);
  }

  getInstance(parserOptions, readonlyMatcher) {
    return new NodeTreeBuilder(
      parserOptions,
      this.builderOptions,
      readonlyMatcher,
      this.registry,
    );
  }
}

export class NodeTreeBuilder extends BaseOutputBuilder {

  /**
 * @param {object}                parserOptions
 * @param {object}                builderOptions
 * @param {MatcherView} readonlyMatcher
 * @param {object}                registry
 */
  constructor(parserOptions, builderOptions, readonlyMatcher, registry) {
    super(parserOptions, builderOptions, readonlyMatcher, registry);
    this.tagsStack = [];
    this.parserOptions = parserOptions;
    this.builderOptions = builderOptions;
    this.groupBy = this.parserOptions.attributes.groupBy || 'attributes';
    this.root = new Node(this._rootName, this.groupBy);
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
        [this.parserOptions.nameFor.text]: this.currentNode.text
      });
      delete this.currentNode.text;
    }

    this.tagsStack.push(this.currentNode);
    const node = new Node(tag.name, this.groupBy);
    // Attach any pending attributes onto the new node
    if (this.attributes && Object.keys(this.attributes).length > 0) {
      node[this.groupBy] = { ...this.attributes };
    }
    this.attributes = {};
    this.currentNode = node;
  }

  closeElement() {
    const node = this.currentNode;
    this.currentNode = this.tagsStack.pop();

    this._pendingStopNode = false;

    if (this.builderOptions.onClose !== undefined) {
      const resultTag = this.builderOptions.onClose(node, this.matcher);
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

    const context = new Context(
      tagName,
      this.matcher,
      !hasElementChildren,
      false,
    );

    const parsedValue = this._pendingStopNode ? text : this.tagsPipeline.run(text, context);

    if (hasElementChildren || this.builderOptions.textInChild) {
      // Mixed content: text alongside child elements — store as inline text child
      this.currentNode.child.push({
        [this.parserOptions.nameFor.text]: parsedValue
      });
    } else {
      // Pure text (leaf node or text before any child elements):
      // set directly on the node as `text` property
      this.currentNode.text = parsedValue;
    }
  }

  addInstruction(name) {
    const node = new Node(name, this.groupBy);
    if (!isEmpty(this.attributes)) {
      node[this.groupBy] = this.attributes;
    }
    // this.currentNode.child.push(node);
    this._addChild(node);
    this.attributes = {};
  }

  addComment(text) {
    if (this.parserOptions.skip.comment) return;
    if (this.parserOptions.nameFor.comment) {
      const node = new Node(this.parserOptions.nameFor.comment, this.groupBy);
      node.text = text;
      this._addChild(node);
    }
  }

  addLiteral(text) {
    if (this.parserOptions.skip.cdata) return;
    if (this.parserOptions.nameFor.cdata) {
      const node = new Node(this.parserOptions.nameFor.cdata, this.groupBy);
      node.text = text;
      this._addChild(node);
    } else {
      this.addValue(text || "");
    }
  }

  onExit(exitInfo) { }

  getOutput() {
    const children = this.root.child;
    if (children.length === 1) return children[0];
    return children;
  }
}

class Node {
  constructor(elementname, groupBy) {
    this.elementname = elementname;
    this.child = [];
    this[groupBy] = {};
  }
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}