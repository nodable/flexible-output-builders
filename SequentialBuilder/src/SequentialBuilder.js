import { buildOptions } from './ParserOptionsBuilder.js';
import { BaseOutputBuilder, BaseOutputBuilderFactory, Context } from '@nodable/base-output-builder';
import { MatcherView } from 'path-expression-matcher';

export default class SequentialBuilderFactory extends BaseOutputBuilderFactory {
  constructor(options) {
    super();
    this.builderOptions = buildOptions(options);
  }

  getInstance(parserOptions, readonlyMatcher) {
    return new SequentialBuilder(
      parserOptions,
      this.builderOptions,
      readonlyMatcher,
      this.registry,
    );
  }
}

export class SequentialBuilder extends BaseOutputBuilder {

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
    this.groupBy = parserOptions.attributes.groupBy || 'attributes';
    this.root = new Node(this._rootName, this.groupBy);
    this.currentNode = this.root;
    this.attributes = {};
    this._pendingStopNode = false;
  }

  addElement(tag) {
    // If text arrived before any child element, retroactively migrate it into
    // the children array now that we know this is mixed content.
    if (this.currentNode.text !== undefined) {
      this.currentNode.children.unshift({
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

    // Build the sequential representation:
    // { [tagName]: children, [groupBy]: attributes, text? }
    // Tag name directly points to the children array.
    // Attributes (when present) are a sibling property alongside the tag key.
    const entry = { [node.tagname]: node.children };

    if (node[this.groupBy] && Object.keys(node[this.groupBy]).length > 0) {
      entry[this.groupBy] = node[this.groupBy];
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
      c => !Object.prototype.hasOwnProperty.call(c, this.parserOptions.nameFor.text)
    );

    const context = new Context(
      tagName,
      this.matcher,
      !hasElementChildren,
      false
    );

    const parsedValue = this._pendingStopNode ? text : this.tagsPipeline.run(text, context);

    if (hasElementChildren || this.builderOptions.textInChild) {
      // Mixed content: text alongside child elements — store as inline text child
      this.currentNode.children.push({
        [this.parserOptions.nameFor.text]: parsedValue
      });
    } else {
      // Pure text (leaf node or text before any child elements):
      // set directly on the node; promoted to sibling property in closeElement.
      this.currentNode.text = parsedValue;
    }
  }

  addInstruction(name) {
    const node = new Node(name, this.groupBy);
    if (this.attributes && Object.keys(this.attributes).length > 0) {
      node[this.groupBy] = { ...this.attributes };
    }
    const entry = { [node.tagname]: node.children };
    if (node[this.groupBy] && Object.keys(node[this.groupBy]).length > 0) {
      entry[this.groupBy] = node[this.groupBy];
    }
    this.currentNode.children.push(entry);
    this.attributes = {};
  }

  addComment(text) {
    if (this.parserOptions.skip.comment) return;
    if (this.parserOptions.nameFor.comment) {
      this.currentNode.children.push({ [this.parserOptions.nameFor.comment]: text });
    }
  }

  addLiteral(text) {
    if (this.parserOptions.skip.cdata) return;
    if (this.parserOptions.nameFor.cdata) {
      this.currentNode.children.push({ [this.parserOptions.nameFor.cdata]: text });
    } else {
      this.addValue(text || '');
    }
  }

  onExit(exitInfo) { }

  getOutput() {
    return this.root.children;
  }
}

class Node {
  constructor(tagname, groupBy) {
    this.tagname = tagname;
    this.children = [];
    this[groupBy] = {};
  }
}
