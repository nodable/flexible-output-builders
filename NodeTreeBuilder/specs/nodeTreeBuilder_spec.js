/**
 * nodeTreeBuilder_spec.js
 *
 * Comprehensive tests for NodeTreeBuilder.
 *
 * NodeTreeBuilder output structure:
 *   {
 *     elementname: string,      // tag name
 *     child: array,         // ordered child list (always present, empty for leaf nodes)
 *     attributes: object,   // always present; populated when skip.attributes is false
 *     text?: any            // only present on leaf nodes (no child elements)
 *   }
 *
 * Leaf node (only text, no child elements):
 *   { elementname: "span", child: [], attributes: {}, text: "Hello" }
 *
 * Empty tag (no text, no children):
 *   { elementname: "br", child: [], attributes: {} }
 *
 * Tag with only children (no direct text):
 *   { elementname: "div", child: [...], attributes: {} }
 *
 * Mixed content (text interleaved with child elements):
 *   child array contains { "#text": value } entries for inline text runs.
 *   e.g. <p>Hello <b>world</b>!</p> ->
 *   { elementname: "p", child: [{ "#text": "Hello " }, { elementname: "b", ... }, { "#text": "!" }], attributes: {} }
 *
 * Comment children: { "#comment": <value> }  (key controlled by nameFor.comment)
 * CDATA children: { "#cdata": <value> }       (key controlled by nameFor.cdata)
 *
 * Multiple root nodes -> array; single root -> object directly.
 *
 * Covers:
 *  1.  Basic structure
 *  2.  Text nodes & value parsers
 *  3.  Attributes
 *  4.  Leaf node text property
 *  5.  Mixed content
 *  6.  Comments
 *  7.  CDATA
 *  8.  Processing instructions
 *  9.  Stop nodes
 *  10. nameFor overrides
 *  11. skip options
 *  12. onClose callback
 *  13. Deeply nested & complex structures
 *  14. Document-order preservation
 *  15. Custom value parsers
 *  16. Full snapshot tests
 */

import XMLParser from "@solothought/flexible-xml-parser";
import NodeTreeBuilderFactory from "../src/NodeTreeBuilder.js";
import {
  runAcrossAllInputSources,
  frunAcrossAllInputSources,
  xrunAcrossAllInputSources,
  runAcrossAllInputSourcesWithFactory,
  frunAcrossAllInputSourcesWithFactory,
} from "../../test-helpers/testRunner.js";

// --- Helpers -----------------------------------------------------------------

/**
 * Build XMLParser options with NodeTreeBuilderFactory injected.
 *
 * @param {object} builderOptions - options forwarded to NodeTreeBuilderFactory
 * @param {object} parserOptions  - options forwarded to XMLParser (merged on top)
 */
function makeOptions(builderOptions = {}, parserOptions = {}) {
  return {
    OutputBuilder: new NodeTreeBuilderFactory(builderOptions),
    ...parserOptions,
  };
}

/** Snapshot-style deep comparison helper - strips prototype chain. */
function plain(val) {
  return JSON.parse(JSON.stringify(val));
}

// =============================================================================
// 1. Basic structure
// =============================================================================
describe("NodeTreeBuilder - basic structure", function () {

  runAcrossAllInputSources(
    "single root element is returned as a Node object (not wrapped in array)",
    "<root></root>",
    (result) => {
      expect(typeof result).toBe("object");
      expect(Array.isArray(result)).toBe(false);
      expect(result.elementname).toBe("root");
      expect(Array.isArray(result.child)).toBe(true);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "multiple root-level nodes (declaration + element) are returned as an array",
    `<?xml version="1.0"?><a>1</a>`,
    (result) => {
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "every node has elementname, child and attributes properties",
    "<root><child>hello</child></root>",
    (result) => {
      expect(result.elementname).toBe("root");
      expect(Array.isArray(result.child)).toBe(true);
      expect(result.attributes).toBeDefined();
      expect(result.child[0].elementname).toBe("child");
      expect(Array.isArray(result.child[0].child)).toBe(true);
      expect(result.child[0].attributes).toBeDefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "self-closing tag produces a Node with an empty child array",
    "<root><empty/></root>",
    (result) => {
      expect(result.child[0].elementname).toBe("empty");
      expect(result.child[0].child).toEqual([]);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "empty open/close tag produces a Node with an empty child array",
    "<root><empty></empty></root>",
    (result) => {
      expect(result.child[0].elementname).toBe("empty");
      expect(result.child[0].child).toEqual([]);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "attributes property is always present even when empty",
    "<root><item>x</item></root>",
    (result) => {
      expect(result.attributes).toEqual({});
      expect(result.child[0].attributes).toEqual({});
    },
    makeOptions()
  );

});


// =============================================================================
// 2. Text nodes & value parsers
// =============================================================================
describe("NodeTreeBuilder - text nodes", function () {

  runAcrossAllInputSources(
    "leaf text content is stored as 'text' property on the node, child is empty",
    "<root><b>hello</b></root>",
    (result) => {
      const b = result.child[0];
      expect(b.elementname).toBe("b");
      expect(b.child).toEqual([]);
      expect(b.text).toBe("hello");
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "integer string is converted to number by default value parsers",
    "<root><n>42</n></root>",
    (result) => {
      expect(result.child[0].text).toBe(42);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "float string is converted to number by default value parsers",
    "<root><n>3.14</n></root>",
    (result) => {
      expect(result.child[0].text).toBe(3.14);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "boolean string 'true' is converted to boolean true",
    "<root><flag>true</flag></root>",
    (result) => {
      expect(result.child[0].text).toBe(true);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "boolean string 'false' is converted to boolean false",
    "<root><flag>false</flag></root>",
    (result) => {
      expect(result.child[0].text).toBe(false);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "plain string value is kept as string",
    "<root><label>hello world</label></root>",
    (result) => {
      expect(result.child[0].text).toBe("hello world");
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "XML entities are expanded in text by default (entity parser)",
    "<root><tag>&lt;hello&gt;</tag></root>",
    (result) => {
      // console.log(JSON.stringify(result, null, 2))
      expect(result.child[0].text).toBe("<hello>");
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "disabling all value parsers keeps text as raw string",
    "<root><n>42</n></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "n",
            "child": [],
            "attributes": {},
            "text": 42
          }
        ],
        "attributes": {}
      }

      expect(result.child[0].text).toBe("42");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "leaf node has empty child array (no #text child)",
    "<root><b>hello</b></root>",
    (result) => {
      const b = result.child[0];
      expect(b.child.length).toBe(0);
    },
    makeOptions()
  );

});


// =============================================================================
// 3. Attributes
// =============================================================================
describe("NodeTreeBuilder - attributes", function () {

  runAcrossAllInputSources(
    "attributes property is empty object when skip.attributes is true (default)",
    `<root><item id="1">x</item></root>`,
    (result) => {
      expect(result.child[0].attributes).toEqual({});
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "attributes are populated when skip.attributes is false",
    `<root><item id="1">x</item></root>`,
    (result) => {
      expect(result.child[0].attributes).toBeDefined();
      expect(result.child[0].attributes["@_id"]).toBe(1);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "attribute prefix is configurable",
    `<root><t foo="bar"/></root>`,
    (result) => {
      expect(result.child[0].attributes["attr_foo"]).toBe("bar");
    },
    makeOptions({ attributes: { prefix: "attr_" } }, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "node without attributes has empty attributes object",
    `<root><item>x</item></root>`,
    (result) => {
      expect(result.child[0].attributes).toEqual({});
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "multiple attributes are all captured under 'attributes'",
    `<root><item id="1" class="main" active="true">x</item></root>`,
    (result) => {
      const attrs = result.child[0].attributes;
      expect(attrs["@_id"]).toBe(1);
      expect(attrs["@_class"]).toBe("main");
      expect(attrs["@_active"]).toBe(true);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "attributes on self-closing tags are captured",
    `<root><img src="pic.jpg" width="100"/></root>`,
    (result) => {
      expect(result.child[0].attributes["@_src"]).toBe("pic.jpg");
      expect(result.child[0].attributes["@_width"]).toBe(100);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "leaf text and attributes coexist on the same node",
    `<root><item id="1">text</item></root>`,
    (result) => {
      const item = result.child[0];
      expect(item.attributes["@_id"]).toBe(1);
      expect(item.text).toBe("text");
      expect(item.child).toEqual([]);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "groupBy option changes the key used to group attributes",
    `<root><t foo="bar"/></root>`,
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "t",
            "child": [],
            "attributes": {
              "@_foo": "bar"
            }
          }
        ],
        "attributes": {}
      }


      expect(result.child[0]["@"]["attr_foo"]).toBe("bar");
    },
    makeOptions({
      attributes: { prefix: "attr_", groupBy: "@" }
    },
      {
        skip: { attributes: false }
      })
  );

});


// =============================================================================
// 4. Leaf node text property
// =============================================================================
describe("NodeTreeBuilder - leaf node text property", function () {

  runAcrossAllInputSources(
    "leaf node stores text on node, child array is empty",
    "<root><b>123</b></root>",
    (result) => {
      const b = result.child[0];
      expect(b.elementname).toBe("b");
      expect(b.child).toEqual([]);
      expect(b.text).toBe(123);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "self-closing tag has no text property and empty child array",
    "<root><br/></root>",
    (result) => {
      expect(result.child[0].elementname).toBe("br");
      expect(result.child[0].child).toEqual([]);
      expect(result.child[0].text).toBeUndefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "empty open/close tag has no text property",
    "<root><empty></empty></root>",
    (result) => {
      expect(result.child[0].elementname).toBe("empty");
      expect(result.child[0].child).toEqual([]);
      expect(result.child[0].text).toBeUndefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "leaf node with attributes has both text and attributes properties",
    `<root><item id="1">hello</item></root>`,
    (result) => {
      const item = result.child[0];
      expect(item.text).toBe("hello");
      expect(item.attributes["@_id"]).toBe(1);
      expect(item.child).toEqual([]);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "parent node with only element children has no text property",
    "<root><parent><child>val</child></parent></root>",
    (result) => {
      const parent = result.child[0];
      expect(parent.elementname).toBe("parent");
      expect(parent.text).toBeUndefined();
      expect(parent.child.length).toBe(1);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "deeply nested leaf has text on itself only",
    "<root><a><b><c>deep</c></b></a></root>",
    (result) => {
      const c = result.child[0].child[0].child[0];
      expect(c.elementname).toBe("c");
      expect(c.text).toBe("deep");
      expect(c.child).toEqual([]);
      expect(result.child[0].text).toBeUndefined();
      expect(result.child[0].child[0].text).toBeUndefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "sibling leaf nodes each have their own text property",
    "<root><x>1</x><y>2</y><z>3</z></root>",
    (result) => {
      expect(result.child[0].text).toBe(1);
      expect(result.child[1].text).toBe(2);
      expect(result.child[2].text).toBe(3);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "repeated same-name leaf tags each get their own text property",
    "<root><b>123</b><b>456</b><b>789</b></root>",
    (result) => {
      expect(result.child[0].text).toBe(123);
      expect(result.child[1].text).toBe(456);
      expect(result.child[2].text).toBe(789);
    },
    makeOptions()
  );

});


// =============================================================================
// 5. Mixed content
// =============================================================================
describe("NodeTreeBuilder - mixed content", function () {

  runAcrossAllInputSources(
    "text before child element appears as '#text' entry in child array",
    "<root><p>before<b>bold</b></p></root>",
    (result) => {
      const p = result.child[0];
      expect(p.child[0]["#text"]).toBe("before");
      expect(p.child[1].elementname).toBe("b");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "text after child element appears as '#text' entry in child array",
    "<root><p><b>bold</b>after</p></root>",
    (result) => {
      const p = result.child[0];
      expect(p.child[0].elementname).toBe("b");
      expect(p.child[1]["#text"]).toBe("after");
    },
    makeOptions({}, { tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "text between child elements appears in document order as '#text' entries",
    "<root><p>before<b>bold</b>after</p></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "p",
            "child": [
              {
                "#text": "before"
              },
              {
                "elementname": "b",
                "child": [],
                "attributes": {},
                "text": "bold"
              },
              {
                "#text": "after"
              }
            ],
            "attributes": {}
          }
        ],
        "attributes": {}
      }

      // console.log(JSON.stringify(result, null, 2))
      const p = result.child[0];
      expect(p.child[0]["#text"]).toBe("before");
      expect(p.child[1].elementname).toBe("b");
      expect(p.child[2]["#text"]).toBe("after");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );
  runAcrossAllInputSources(
    "text inerts in child elements when textInChild is true",
    "<root><p>before<b>bold</b>after</p></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "p",
            "child": [
              {
                "#text": "before"
              },
              {
                "elementname": "b",
                "child": [
                  { "#text": "bold" }
                ],
                "attributes": {}
              },
              {
                "#text": "after"
              }
            ],
            "attributes": {}
          }
        ],
        "attributes": {}
      }

      // console.log(JSON.stringify(result, null, 2))
      const p = result.child[0];
      expect(p.child[0]["#text"]).toBe("before");
      expect(p.child[1].elementname).toBe("b");
      expect(p.child[2]["#text"]).toBe("after");
    },
    makeOptions({ tags: { valueParsers: [] }, textInChild: true })
  );

  runAcrossAllInputSources(
    "mixed content parent has no 'text' property on itself",
    "<root><p>text<b>bold</b></p></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "p",
            "child": [
              {
                "#text": "text"
              },
              {
                "elementname": "b",
                "child": [],
                "attributes": {},
                "text": "bold"
              }
            ],
            "attributes": {}
          }
        ],
        "attributes": {}
      }

      expect(result.child[0].text).toBeUndefined();
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "the inline child element in mixed content is a full leaf Node",
    "<root><p>Hello <b>world</b>!</p></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "p",
            "child": [
              {
                "#text": "Hello "
              },
              {
                "elementname": "b",
                "child": [],
                "attributes": {},
                "text": "world"
              },
              {
                "#text": "!"
              }
            ],
            "attributes": {}
          }
        ],
        "attributes": {}
      }


      const p = result.child[0];
      const b = p.child[1];
      expect(b.elementname).toBe("b");
      expect(b.child).toEqual([]);
      expect(b.text).toBe("world");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "nameFor.text changes the key used for inline text in mixed content",
    "<root><p>Hello <b>world</b></p></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "p",
            "child": [
              {
                "_t": "Hello "
              },
              {
                "elementname": "b",
                "child": [],
                "attributes": {},
                "text": "world"
              }
            ],
            "attributes": {}
          }
        ],
        "attributes": {}
      }

      const p = result.child[0];
      expect(p.child[0]["_t"]).toBe("Hello ");
    },
    makeOptions({ nameFor: { text: "_t" }, tags: { valueParsers: [] } })
  );

});


// =============================================================================
// 6. Comments
// =============================================================================
describe("NodeTreeBuilder - comments", function () {

  runAcrossAllInputSources(
    "comments are omitted when nameFor.comment is '' (default)",
    `<root><!--A comment--><tag>value</tag></root>`,
    (result) => {
      const childTagnames = result.child.map((c) => c.elementname).filter(Boolean);
      expect(childTagnames).toContain("tag");
      const hasComment = result.child.some((c) => c["#comment"] !== undefined);
      expect(hasComment).toBe(false);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "comments appear as child objects when nameFor.comment is set",
    `<root><!--Hello--><tag>value</tag></root>`,
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "#comment",
            "child": [],
            "attributes": {},
            "text": "Hello"
          },
          {
            "elementname": "tag",
            "child": [],
            "attributes": {},
            "text": "value"
          }
        ],
        "attributes": {}
      }
      // console.log(JSON.stringify(result, null, 2))
      expect(result.child[0].elementname).toBe("#comment");
      expect(result.child[1].elementname).toBe("tag");

      expect(result.child[0].text).toBe("Hello");
      expect(result.child[1].text).toBe("value");
    },
    makeOptions({ nameFor: { comment: "#comment" } })
  );

  runAcrossAllInputSources(
    "comment order relative to elements is preserved",
    `<root><!--First--><a>1</a><!--2--><b>2</b></root>`,
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "#comment",
            "child": [],
            "attributes": {},
            "text": "First"
          },
          {
            "elementname": "a",
            "child": [],
            "attributes": {},
            "text": 1
          },
          {
            "elementname": "#comment",
            "child": [],
            "attributes": {},
            "text": "2"
          },
          {
            "elementname": "b",
            "child": [],
            "attributes": {},
            "text": 2
          }
        ],
        "attributes": {}
      }
      // console.log(JSON.stringify(result, null, 2))
      const plainResult = JSON.parse(JSON.stringify(result))
      expect(plainResult).toEqual(expected)
    },
    makeOptions({ nameFor: { comment: "#comment" } })
  );

  runAcrossAllInputSources(
    "skip.comment: true omits comments even when nameFor.comment is set",
    `<root><!--Skipped--><tag>value</tag></root>`,
    (result) => {
      const hasComment = result.child.some((c) => c["#comment"] !== undefined);
      expect(hasComment).toBe(false);
    },
    makeOptions({}, { skip: { comment: true }, nameFor: { comment: "#comment" } })
  );

  runAcrossAllInputSources(
    "multiple consecutive comments all appear in child array",
    `<root><!--One--><!--Two--><!--Three--><tag>v</tag></root>`,
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "#comment",
            "child": [],
            "attributes": {},
            "text": "One"
          },
          {
            "elementname": "#comment",
            "child": [],
            "attributes": {},
            "text": "Two"
          },
          {
            "elementname": "#comment",
            "child": [],
            "attributes": {},
            "text": "Three"
          },
          {
            "elementname": "tag",
            "child": [],
            "attributes": {},
            "text": "v"
          }
        ],
        "attributes": {}
      }
      // console.log(JSON.stringify(result, null, 2))
      const plainResult = JSON.parse(JSON.stringify(result))
      expect(plainResult).toEqual(expected)
    },
    makeOptions({ nameFor: { comment: "#comment" } })
  );

  runAcrossAllInputSources(
    "preserves document order when root-level comment precedes root element",
    `<!--Root comment--><root><tag>value</tag></root>`,
    (result) => {
      const expected = [
        {
          "elementname": "#comment",
          "child": [],
          "attributes": {},
          "text": "Root comment"
        },
        {
          "elementname": "root",
          "child": [
            {
              "elementname": "tag",
              "child": [],
              "attributes": {},
              "text": "value"
            }
          ],
          "attributes": {}
        }
      ]
      // console.log(JSON.stringify(result, null, 2))
      expect(result[0].text).toEqual("Root comment");
      expect(result[0].elementname).toEqual("#comment");
    },
    makeOptions({ nameFor: { comment: "#comment" } })
  );

});


// =============================================================================
// 7. CDATA
// =============================================================================
describe("NodeTreeBuilder - CDATA", function () {

  runAcrossAllInputSources(
    "CDATA merged into text (default nameFor.cdata='') appears as 'text' on node",
    "<root><code><![CDATA[x < 1]]></code></root>",
    (result) => {
      expect(result.child[0].text).toBe("x < 1");
      expect(result.child[0].child).toEqual([]);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "CDATA with its own key produces a separate child entry",
    "<root><code><![CDATA[x < 1]]></code></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "code",
            "child": [
              {
                "elementname": "#cdata",
                "child": [],
                "attributes": {},
                "text": "x < 1"
              }
            ],
            "attributes": {}
          }
        ],
        "attributes": {}
      }

      const code = result.child[0];
      expect(code.elementname).toBe("code");
      expect(code.child[0].elementname).toBe("#cdata");
      expect(code.child[0].text).toBe("x < 1");
    },
    makeOptions({ nameFor: { cdata: "#cdata" } }, { skip: { cdata: false } })
  );

  runAcrossAllInputSources(
    "CDATA preserves special characters without parsing",
    `<root><xml><![CDATA[<tag attr="value">text & more</tag>]]></xml></root>`,
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "xml",
            "child": [
              {
                "elementname": "#cdata",
                "child": [],
                "attributes": {},
                "text": "<tag attr=\"value\">text & more</tag>"
              }
            ],
            "attributes": {}
          }
        ],
        "attributes": {}
      }
      // console.log(JSON.stringify(result, null, 2))
      expect(result.child[0].child[0].text).toEqual('<tag attr="value">text & more</tag>');
    },
    makeOptions({ nameFor: { cdata: "#cdata" } }, { skip: { cdata: false } })
  );

  runAcrossAllInputSources(
    "skip.cdata: true removes CDATA from output entirely",
    "<root><script><![CDATA[some code here]]></script></root>",
    (result) => {
      expect(result.child[0].child).toEqual([]);
      expect(result.child[0].text).toBeUndefined();
    },
    makeOptions({}, { skip: { cdata: true } })
  );

});


// =============================================================================
// 8. Processing instructions
// =============================================================================
describe("NodeTreeBuilder - processing instructions", function () {

  runAcrossAllInputSources(
    "XML declaration is included as a Node sibling to the root element",
    `<?xml version="1.0"?><root/>`,
    (result) => {
      expect(Array.isArray(result)).toBe(true);
      const piNode = result.find((n) => n.elementname === "?xml");
      expect(piNode).toBeDefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources( //BUG
    //Expectation: 
    // when skip.declaration is true, then declaration should not be present in output
    // when skip.declaration is false, then declaration should be present in output. 
    //    Response should be array of 2 objects. PI or declaration should not have text value as no body.
    //    More objects on root level are possible. like comments or processing instructions
    "XML declaration attributes are captured when skip.attributes is false",
    `<?xml version="1.0" encoding="UTF-8"?><root/>`,
    (result) => {
      const expected = [
        {
          "elementname": "?xml",
          "child": [],
          "attributes": {
            "@_version": 1,
            "@_encoding": "UTF-8"
          }
        },
        {
          "elementname": "root",
          "child": [],
          "attributes": {}
        }
      ]

      // console.log(JSON.stringify(result, null, 2))
      const piNode = result.find((n) => n.elementname === "?xml");
      expect(piNode.attributes["@_version"]).toBe(1);
      expect(piNode.attributes["@_encoding"]).toBe("UTF-8");
    },
    makeOptions({}, { skip: { attributes: false, declaration: false } })
  );

  runAcrossAllInputSources(
    "non-declaration PI tags appear as Node siblings",
    `<?xml version="1.0"?><?xml-stylesheet href="style.css"?><root/>`,
    (result) => {
      const piNode = result.find((n) => n.elementname === "?xml-stylesheet");
      expect(piNode).toBeDefined();
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources( //BUG
    "PI tag attributes are captured",
    `<?xml-stylesheet href="mystyle.xslt" type="text/xsl"?><root/>`,
    (result) => {
      const expected = [
        {
          "elementname": "?xml-stylesheet",
          "child": [],
          "attributes": {
            "@_href": "mystyle.xslt",
            "@_type": "text/xsl"
          }
        },
        {
          "elementname": "root",
          "child": [],
          "attributes": {}
        }
      ]



      // console.log(JSON.stringify(result, null, 2))
      const piNode = Array.isArray(result)
        ? result.find((n) => n.elementname === "?xml-stylesheet")
        : result;
      expect(piNode.attributes["@_href"]).toBe("mystyle.xslt");
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "skip.pi: true omits non-declaration PI tags",
    `<?xml version="1.0"?><?xml-stylesheet href="a.css"?><root/>`,
    (result) => {
      const hasSS = Array.isArray(result) &&
        result.some((n) => n.elementname === "?xml-stylesheet");
      expect(hasSS).toBe(false);
    },
    makeOptions({}, { skip: { pi: true } })
  );

  runAcrossAllInputSources(
    "PI node inside a root element appears as a child",
    `<root><?proc data="x"?><child>value</child></root>`,
    (result) => {
      const piChild = result.child.find((c) => c.elementname === "?proc");
      expect(piChild).toBeDefined();
    },
    makeOptions({}, { skip: { attributes: false } })
  );

});


// =============================================================================
// 9. Stop nodes
// =============================================================================
describe("NodeTreeBuilder - stop nodes", function () {

  runAcrossAllInputSources(
    "stop node raw content is stored as 'text' on the node",
    "<root><script>let x = 1;</script></root>",
    (result) => {

      const scriptNode = result.child[0];
      expect(scriptNode.elementname).toBe("script");
      expect(scriptNode.text).toBe("let x = 1;");
      expect(scriptNode.child).toEqual([]);
    },
    makeOptions({}, { tags: { stopNodes: ["*.script"] } })
  );

  runAcrossAllInputSources(
    "stop node with nested XML preserved as raw string in text property",
    "<root><raw><b>bold</b></raw></root>",
    (result) => {

      const rawNode = result.child[0];
      expect(rawNode.elementname).toBe("raw");
      expect(rawNode.text).toContain("<b>bold</b>");
    },
    makeOptions({}, { tags: { stopNodes: ["..raw"] } })
  );

  runAcrossAllInputSources(
    "multiple stop nodes each become a Node with raw text property",
    "<root><a>raw1</a><b>raw2</b></root>",
    (result) => {
      expect(result.child[0].elementname).toBe("a");
      expect(result.child[0].text).toContain("raw1");
      expect(result.child[1].elementname).toBe("b");
      expect(result.child[1].text).toContain("raw2");
    },
    makeOptions({}, { tags: { stopNodes: ["*.a", "*.b"] } })
  );

  runAcrossAllInputSources(
    "wildcard (..) stop node matches at any depth",
    "<root><div><script>code</script></div></root>",
    (result) => {
      const div = result.child[0];
      const script = div.child[0];
      expect(script.elementname).toBe("script");
      expect(script.text).toContain("code");
    },
    makeOptions({}, { tags: { stopNodes: ["..script"] } })
  );

  it("onStopNode callback is invoked with tagDetail and rawContent", function () {
    const spy = jasmine.createSpy("onStopNode");
    const parser = new XMLParser(makeOptions(
      { onStopNode: spy },
      { tags: { stopNodes: ["*.noParse"] } }
    ));
    parser.parse("<root><noParse>raw</noParse></root>");
    expect(spy).toHaveBeenCalledTimes(1);
    const [tagDetail, rawContent] = spy.calls.mostRecent().args;
    expect(tagDetail.name).toBe("noParse");
    expect(rawContent).toBe("raw");
  });

});


// =============================================================================
// 10. nameFor overrides
// =============================================================================
describe("NodeTreeBuilder - nameFor overrides", function () {

  runAcrossAllInputSources(
    "nameFor.comment changes the key for comment nodes",
    `<root><!--hello--></root>`,
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "##",
            "child": [],
            "attributes": {},
            "text": "hello"
          }
        ],
        "attributes": {}
      }


      // console.log(JSON.stringify(result, null, 2))
      const plainResult = JSON.parse(JSON.stringify(result));
      expect(plainResult).toEqual(expected);
    },
    makeOptions({ nameFor: { comment: "##" } })
  );

  runAcrossAllInputSources(
    "nameFor.cdata changes the key for CDATA child nodes",
    "<root><code><![CDATA[data]]></code></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "code",
            "child": [
              {
                "elementname": "##cdata",
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
      // console.log(JSON.stringify(result, null, 2));
      const plainResult = JSON.parse(JSON.stringify(result))
      expect(plainResult).toEqual(expected)
    },
    makeOptions({ nameFor: { cdata: "##cdata" } }, { skip: { cdata: false } })
  );

  runAcrossAllInputSources(
    "nameFor.text changes the key for inline text in mixed content",
    "<root><p>Hello <b>world</b></p></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "p",
            "child": [
              {
                "_": "Hello "
              },
              {
                "elementname": "b",
                "child": [],
                "attributes": {},
                "text": "world"
              }
            ],
            "attributes": {}
          }
        ],
        "attributes": {}
      }

      expect(result.child[0].child[0]["_"]).toBe("Hello ");
    },
    makeOptions({ nameFor: { text: "_" }, tags: { valueParsers: [] } })
  );

});


// =============================================================================
// 11. skip options
// =============================================================================
describe("NodeTreeBuilder - skip options", function () {

  runAcrossAllInputSources(
    "skip.attributes: true (default) - attributes property is empty object",
    `<root><item id="1" class="a">x</item></root>`,
    (result) => {
      expect(result.child[0].attributes).toEqual({});
    },
    makeOptions({}, { skip: { attributes: true } })
  );

  runAcrossAllInputSources(
    "skip.cdata: true - CDATA sections removed, no text on node either",
    "<root><tag><![CDATA[content]]></tag></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "tag",
            "child": [],
            "attributes": {},
            "text": "content"
          }
        ],
        "attributes": {}
      }

      expect(result.child[0].child).toEqual([]);
      expect(result.child[0].text).toBeUndefined();
    },
    makeOptions({}, { skip: { cdata: true } })
  );

  runAcrossAllInputSources(
    "skip.comment: true - no comment nodes in child array",
    `<root><!--comment--><tag>v</tag></root>`,
    (result) => {
      const hasComment = result.child.some((c) => c["#comment"] !== undefined);
      expect(hasComment).toBe(false);
    },
    makeOptions({}, { skip: { comment: true }, nameFor: { comment: "#comment" } })
  );

});


// =============================================================================
// 12. onClose callback
// =============================================================================
describe("NodeTreeBuilder - onClose callback", function () {

  it("onClose receives the completed Node before it is added to parent", function () {
    const collected = [];
    const parser = new XMLParser(makeOptions({
      onClose(node) {
        collected.push({ name: node.elementname, childCount: node.child.length });
      }
    }));
    parser.parse("<root><a>1</a><b>2</b></root>");
    const names = collected.map((n) => n.name);
    expect(names).toContain("a");
    expect(names).toContain("b");
    expect(names).toContain("root");
  });

  it("onClose returning truthy suppresses the node from being added to parent", function () {
    const parser = new XMLParser(makeOptions({
      onClose(node) {
        if (node.elementname === "a") return true;
      }
    }));
    const result = parser.parse("<root><a>1</a><b>2</b></root>");
    const names = result.child.map((n) => n.elementname);
    expect(names).not.toContain("a");
    expect(names).toContain("b");
  });

  it("onClose returning falsy allows the node to be added normally", function () {
    const parser = new XMLParser(makeOptions({
      onClose(node) { return false; }
    }));
    const result = parser.parse("<root><a>1</a></root>");
    expect(result.child[0].elementname).toBe("a");
  });

  runAcrossAllInputSourcesWithFactory(
    "onClose suppressing all children leaves root with empty child array",
    "<root><a>1</a><b>2</b></root>",
    (result) => {
      expect(result.elementname).toBe("root");
      expect(result.child).toEqual([]);
    },
    () => new XMLParser(makeOptions({
      onClose(node) {
        if (node.elementname !== "root") return true;
      }
    }))
  );

  it("onClose receives node with text property set for leaf nodes", function () {
    const collected = [];
    const parser = new XMLParser(makeOptions({
      onClose(node) {
        collected.push({ name: node.elementname, text: node.text });
      }
    }));
    parser.parse("<root><a>hello</a><b>42</b></root>");
    const a = collected.find(n => n.name === "a");
    const b = collected.find(n => n.name === "b");
    expect(a.text).toBe("hello");
    expect(b.text).toBe(42);
  });

});


// =============================================================================
// 13. Deeply nested & complex structures
// =============================================================================
describe("NodeTreeBuilder - deeply nested and complex structures", function () {

  runAcrossAllInputSources(
    "5-level deep nesting is handled correctly",
    "<a><b><c><d><e>deep</e></d></c></b></a>",
    (result) => {
      expect(result.elementname).toBe("a");
      expect(result.child[0].elementname).toBe("b");
      expect(result.child[0].child[0].elementname).toBe("c");
      expect(result.child[0].child[0].child[0].elementname).toBe("d");
      const e = result.child[0].child[0].child[0].child[0];
      expect(e.elementname).toBe("e");
      expect(e.text).toBe("deep");
      expect(e.child).toEqual([]);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "sibling and nested repetition of the same tag name works",
    "<root><item><sub>1</sub></item><item><sub>2</sub></item></root>",
    (result) => {
      expect(result.child.length).toBe(2);
      expect(result.child[0].child[0].text).toBe(1);
      expect(result.child[1].child[0].text).toBe(2);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "text and element children can be interleaved at any depth",
    "<root><p>text<b>bold</b>more</p></root>",
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "p",
            "child": [
              { "#text": "text" },
              { "elementname": "b", "child": [], "attributes": {}, "text": "bold" },
              { "#text": "more" }
            ],
            "attributes": {}
          }
        ],
        "attributes": {}
      }
      // console.log(JSON.stringify(result))
      const p = result.child[0];
      expect(p.child[0]["#text"]).toBe("text");
      expect(p.child[1].elementname).toBe("b");
      expect(p.child[2]["#text"]).toBe("more");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

});


// =============================================================================
// 14. Document-order preservation
// =============================================================================
describe("NodeTreeBuilder - document order preservation", function () {

  runAcrossAllInputSources(
    "sibling elements appear in document order",
    "<root><first>1</first><second>2</second><third>3</third></root>",
    (result) => {
      const names = result.child.map((n) => n.elementname);
      expect(names).toEqual(["first", "second", "third"]);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "repeated same-name siblings appear in document order",
    "<root><item>a</item><item>b</item><item>c</item></root>",
    (result) => {
      const items = result.child.filter((n) => n.elementname === "item");
      expect(items.length).toBe(3);
      expect(items[0].text).toBe("a");
      expect(items[1].text).toBe("b");
      expect(items[2].text).toBe("c");
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "interleaved comments and elements preserve order",
    `<root><!--c1--><a>1</a><!--c2--><b>2</b><!--c3--></root>`,
    (result) => {
      const expected = {
        "elementname": "root",
        "child": [
          {
            "elementname": "#comment",
            "child": [],
            "attributes": {},
            "text": "c1"
          },
          {
            "elementname": "a",
            "child": [],
            "attributes": {},
            "text": 1
          },
          {
            "elementname": "#comment",
            "child": [],
            "attributes": {},
            "text": "c2"
          },
          {
            "elementname": "b",
            "child": [],
            "attributes": {},
            "text": 2
          },
          {
            "elementname": "#comment",
            "child": [],
            "attributes": {},
            "text": "c3"
          }
        ],
        "attributes": {}
      }
      // console.log(JSON.stringify(result, null, 2))
      expect(result.child[0].text).toBe("c1");
      expect(result.child[1].text).toBe(1);
      expect(result.child[2].text).toBe("c2");
      expect(result.child[3].text).toBe(2);
      expect(result.child[4].text).toBe("c3");

      expect(result.child[0].elementname).toBe("#comment");
      expect(result.child[1].elementname).toBe("a");
      expect(result.child[2].elementname).toBe("#comment");
      expect(result.child[3].elementname).toBe("b");
      expect(result.child[4].elementname).toBe("#comment");
    },
    makeOptions({ nameFor: { comment: "#comment" } })
  );

  runAcrossAllInputSources(
    "deeply nested structure preserves element order at each level",
    "<root><a><x>1</x><y>2</y></a><b><x>3</x><y>4</y></b></root>",
    (result) => {
      const a = result.child[0];
      expect(a.child[0].elementname).toBe("x");
      expect(a.child[1].elementname).toBe("y");
      const b = result.child[1];
      expect(b.child[0].elementname).toBe("x");
      expect(b.child[1].elementname).toBe("y");
    },
    makeOptions()
  );

});


// =============================================================================
// 15. Custom value parsers
// =============================================================================
describe("NodeTreeBuilder - custom value parsers", function () {

  runAcrossAllInputSources(
    "empty valueParsers array keeps all values as raw strings",
    "<root><n>42</n><b>true</b></root>",
    (result) => {

      expect(result.child[0].text).toBe("42");
      expect(result.child[1].text).toBe("true");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "trim parser in chain removes surrounding whitespace",
    "<root><tag>  trimmed  </tag></root>",
    (result) => {
      expect(result.child[0].text).toBe("trimmed");
    },
    makeOptions({ tags: { valueParsers: ["trim", "boolean", "number"] } })
  );

});


// =============================================================================
// 16. Full snapshot tests (structure correctness)
// =============================================================================
describe("NodeTreeBuilder - full snapshot tests", function () {

  runAcrossAllInputSources(
    "README example: root with two leaf children produces correct Node tree",
    "<root><child>hello</child><child>world</child></root>",
    (result) => {
      const expected = {
        elementname: "root",
        child: [
          {
            elementname: "child",
            child: [],
            attributes: {},
            text: "hello",
          },
          {
            elementname: "child",
            child: [],
            attributes: {},
            text: "world",
          },
        ],
        attributes: {},
      };
      expect(plain(result)).toEqual(expected);
    },
    makeOptions({}, { tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "attribute example produces correct attributes grouping on leaf node",
    `<root><item id="1">hello</item></root>`,
    (result) => {
      const expected = {
        elementname: "root",
        child: [
          {
            elementname: "item",
            child: [],
            attributes: { "@_id": 1 },
            text: "hello",
          },
        ],
        attributes: {},
      };
      expect(plain(result)).toEqual(expected);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "empty tag snapshot: no text property, empty child and attributes",
    "<root><br/></root>",
    (result) => {
      const expected = {
        elementname: "root",
        child: [
          {
            elementname: "br",
            child: [],
            attributes: {},
          },
        ],
        attributes: {},
      };
      expect(plain(result)).toEqual(expected);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "mixed content snapshot",
    "<root><p>Hello <b>world</b>!</p></root>",
    (result) => {

      const expected = {
        elementname: "root",
        child: [
          {
            elementname: "p",
            child: [
              { "#text": "Hello " },
              { elementname: "b", child: [], attributes: {}, text: "world" },
              { "#text": "!" },
            ],
            attributes: {},
          },
        ],
        attributes: {},
      };
      expect(plain(result)).toEqual(expected);
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "nested structure snapshot",
    "<root><a><b>1</b><c>two</c></a></root>",
    (result) => {
      const expected = {
        elementname: "root",
        child: [
          {
            elementname: "a",
            child: [
              { elementname: "b", child: [], attributes: {}, text: 1 },
              { elementname: "c", child: [], attributes: {}, text: "two" },
            ],
            attributes: {},
          },
        ],
        attributes: {},
      };
      expect(plain(result)).toEqual(expected);
    },
    makeOptions()
  );

});