/**
 * sequentialBuilder_spec.js
 *
 * Comprehensive tests for SequentialBuilder.
 *
 * SequentialBuilder output structure:
 *   getOutput() always returns an array (even for a single root element).
 *
 *   Each entry in the array is an object where:
 *     - The tag name is a key pointing directly to its children array.
 *     - Attributes (when present) appear as a sibling property (controlled by groupBy).
 *     - `text` is a sibling property on leaf nodes (no element children).
 *     - Mixed content: inline text runs appear as { [nameFor.text]: value } entries
 *       inside the children array; the entry itself has no `text` property.
 *
 * Examples:
 *
 *   Leaf:          { span: [], text: "Hello" }
 *   Empty:         { br: [] }
 *   With attrs:    { item: [], attributes: { "@_id": 1 }, text: "val" }
 *   With children: { div: [ { span: [], text: "Hi" } ] }
 *   Mixed:         { p: [ { "#text": "before" }, { b: [], text: "bold" }, { "#text": "after" } ] }
 *
 * Covers:
 *  1.  Basic structure — getOutput always returns array
 *  2.  Text nodes & value parsers
 *  3.  Attributes — sibling property, groupBy, prefix
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

import XMLParser from "@nodable/flexible-xml-parser";
import SequentialBuilderFactory from "../src/SequentialBuilder.js";
import {
  runAcrossAllInputSources,
  frunAcrossAllInputSources,
  xrunAcrossAllInputSources,
  runAcrossAllInputSourcesWithFactory,
  frunAcrossAllInputSourcesWithFactory,
} from "../../test-helpers/testRunner.js";

// --- Helpers -----------------------------------------------------------------

function makeOptions(builderOptions = {}, parserOptions = {}) {
  return {
    OutputBuilder: new SequentialBuilderFactory(builderOptions),
    ...parserOptions,
  };
}

function plain(val) {
  return JSON.parse(JSON.stringify(val));
}

// =============================================================================
// 1. Basic structure
// =============================================================================
describe("SequentialBuilder - basic structure", function () {

  runAcrossAllInputSources(
    "getOutput always returns an array, even for a single root element",
    "<root></root>",
    (result) => {
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "single root element — entry has tag name as key pointing to children array",
    "<root></root>",
    (result) => {
      const entry = result[0];
      expect(entry).toBeDefined();
      expect(Array.isArray(entry["root"])).toBe(true);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "there is no 'elementname' or 'tagname' property on entries",
    "<root><child>hello</child></root>",
    (result) => {
      const root = result[0];
      expect(root.elementname).toBeUndefined();
      expect(root.tagname).toBeUndefined();
      const child = root["root"][0];
      expect(child.elementname).toBeUndefined();
      expect(child.tagname).toBeUndefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "there is no standalone 'child' array property — tag name is the key",
    "<root><child>hello</child></root>",
    (result) => {
      const root = result[0];
      expect(root.child).toBeUndefined();
      expect(Array.isArray(root["root"])).toBe(true);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "self-closing tag produces an entry with an empty array",
    "<root><empty/></root>",
    (result) => {
      const child = result[0]["root"][0];
      expect(Array.isArray(child["empty"])).toBe(true);
      expect(child["empty"]).toEqual([]);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "empty open/close tag produces an entry with an empty array",
    "<root><empty></empty></root>",
    (result) => {
      const child = result[0]["root"][0];
      expect(Array.isArray(child["empty"])).toBe(true);
      expect(child["empty"]).toEqual([]);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "multiple root-level nodes (declaration + element) — array has multiple entries",
    `<?xml version="1.0"?><a>1</a>`,
    (result) => {
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
    },
    makeOptions()
  );

});


// =============================================================================
// 2. Text nodes & value parsers
// =============================================================================
describe("SequentialBuilder - text nodes", function () {

  runAcrossAllInputSources(
    "leaf text content is stored as 'text' sibling property; children array is empty",
    "<root><b>hello</b></root>",
    (result) => {
      const entry = result[0]["root"][0];
      expect(Array.isArray(entry["b"])).toBe(true);
      expect(entry["b"]).toEqual([]);
      expect(entry.text).toBe("hello");
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "integer string is converted to number by default value parsers",
    "<root><n>42</n></root>",
    (result) => {
      expect(result[0]["root"][0].text).toBe(42);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "float string is converted to number by default value parsers",
    "<root><n>3.14</n></root>",
    (result) => {
      expect(result[0]["root"][0].text).toBe(3.14);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "boolean string 'true' is converted to boolean true",
    "<root><flag>true</flag></root>",
    (result) => {
      expect(result[0]["root"][0].text).toBe(true);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "boolean string 'false' is converted to boolean false",
    "<root><flag>false</flag></root>",
    (result) => {
      expect(result[0]["root"][0].text).toBe(false);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "plain string value is kept as string",
    "<root><label>hello world</label></root>",
    (result) => {
      expect(result[0]["root"][0].text).toBe("hello world");
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "XML entities are expanded in text by default (entity parser)",
    "<root><tag>&lt;hello&gt;</tag></root>",
    (result) => {
      expect(result[0]["root"][0].text).toBe("<hello>");
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "leaf node has empty children array (no #text child)",
    "<root><b>hello</b></root>",
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry["b"].length).toBe(0);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "parent node with only element children has no 'text' property",
    "<root><parent><child>val</child></parent></root>",
    (result) => {
      const parentEntry = result[0]["root"][0];
      expect(parentEntry.text).toBeUndefined();
      expect(parentEntry["parent"].length).toBe(1);
    },
    makeOptions()
  );

});


// =============================================================================
// 3. Attributes — sibling property
// =============================================================================
describe("SequentialBuilder - attributes", function () {

  runAcrossAllInputSources(
    "attributes property is absent when skip.attributes is true (default)",
    `<root><item id="1">x</item></root>`,
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry.attributes).toBeUndefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "attributes are populated as sibling property when skip.attributes is false",
    `<root><item id="1">x</item></root>`,
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry.attributes).toBeDefined();
      expect(entry.attributes["@_id"]).toBe(1);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "attributes are a sibling of the tag key, not nested inside it",
    `<root><item id="1">x</item></root>`,
    (result) => {
      const entry = result[0]["root"][0];
      // entry["item"] is the children array; attributes sit alongside it
      expect(Array.isArray(entry["item"])).toBe(true);
      expect(entry.attributes["@_id"]).toBe(1);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "attribute prefix is configurable",
    `<root><t foo="bar"/></root>`,
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry.attributes["attr_foo"]).toBe("bar");
    },
    makeOptions({ attributes: { prefix: "attr_" } }, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "groupBy option changes the sibling key for attributes",
    `<root><t foo="bar"/></root>`,
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry["@"]["attr_foo"]).toBe("bar");
      expect(entry.attributes).toBeUndefined();
    },
    makeOptions(
      { attributes: { prefix: "attr_", groupBy: "@" } },
      { skip: { attributes: false } }
    )
  );

  runAcrossAllInputSources(
    "multiple attributes are all captured under the groupBy property",
    `<root><item id="1" class="main" active="true">x</item></root>`,
    (result) => {
      const attrs = result[0]["root"][0].attributes;
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
      const attrs = result[0]["root"][0].attributes;
      expect(attrs["@_src"]).toBe("pic.jpg");
      expect(attrs["@_width"]).toBe(100);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "leaf text and attributes coexist as sibling properties on the same entry",
    `<root><item id="1">text</item></root>`,
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry.attributes["@_id"]).toBe(1);
      expect(entry.text).toBe("text");
      expect(entry["item"]).toEqual([]);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "node without attributes has no attributes property in the entry",
    `<root><item>x</item></root>`,
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry.attributes).toBeUndefined();
    },
    makeOptions({}, { skip: { attributes: false } })
  );

});


// =============================================================================
// 4. Leaf node text property
// =============================================================================
describe("SequentialBuilder - leaf node text property", function () {

  runAcrossAllInputSources(
    "leaf node stores text as sibling property; children array is empty",
    "<root><b>123</b></root>",
    (result) => {
      const entry = result[0]["root"][0];
      expect(Array.isArray(entry["b"])).toBe(true);
      expect(entry["b"]).toEqual([]);
      expect(entry.text).toBe(123);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "self-closing tag has no text property and empty children array",
    "<root><br/></root>",
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry["br"]).toEqual([]);
      expect(entry.text).toBeUndefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "empty open/close tag has no text property",
    "<root><empty></empty></root>",
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry["empty"]).toEqual([]);
      expect(entry.text).toBeUndefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "deeply nested leaf has text on itself only",
    "<root><a><b><c>deep</c></b></a></root>",
    (result) => {
      const a = result[0]["root"][0];
      const b = a["a"][0];
      const c = b["b"][0];
      expect(c.text).toBe("deep");
      expect(c["c"]).toEqual([]);
      expect(a.text).toBeUndefined();
      expect(b.text).toBeUndefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "sibling leaf nodes each have their own text property",
    "<root><x>1</x><y>2</y><z>3</z></root>",
    (result) => {
      const children = result[0]["root"];
      expect(children[0].text).toBe(1);
      expect(children[1].text).toBe(2);
      expect(children[2].text).toBe(3);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "repeated same-name leaf tags each get their own text property",
    "<root><b>123</b><b>456</b><b>789</b></root>",
    (result) => {
      const children = result[0]["root"];
      expect(children[0].text).toBe(123);
      expect(children[1].text).toBe(456);
      expect(children[2].text).toBe(789);
    },
    makeOptions()
  );

});


// =============================================================================
// 5. Mixed content
// =============================================================================
describe("SequentialBuilder - mixed content", function () {

  runAcrossAllInputSources(
    "text before child element appears as '#text' entry in children array",
    "<root><p>before<b>bold</b></p></root>",
    (result) => {
      const p = result[0]["root"][0]["p"];
      expect(p[0]["#text"]).toBe("before");
      expect(Array.isArray(p[1]["b"])).toBe(true);
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "text after child element appears as '#text' entry in children array",
    "<root><p><b>bold</b>after</p></root>",
    (result) => {
      const p = result[0]["root"][0]["p"];
      expect(Array.isArray(p[0]["b"])).toBe(true);
      expect(p[1]["#text"]).toBe("after");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "text between child elements appears in document order as '#text' entries",
    "<root><p>before<b>bold</b>after</p></root>",
    (result) => {
      const p = result[0]["root"][0]["p"];
      expect(p[0]["#text"]).toBe("before");
      expect(Array.isArray(p[1]["b"])).toBe(true);
      expect(p[2]["#text"]).toBe("after");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "mixed content parent has no 'text' property on its entry",
    "<root><p>text<b>bold</b></p></root>",
    (result) => {
      const pEntry = result[0]["root"][0];
      expect(pEntry.text).toBeUndefined();
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "the inline child element in mixed content has its own text property",
    "<root><p>Hello <b>world</b>!</p></root>",
    (result) => {
      const p = result[0]["root"][0]["p"];
      const bEntry = p[1];
      expect(bEntry["b"]).toEqual([]);
      expect(bEntry.text).toBe("world");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "textInChild: true — text is always an inline '#text' child, even on pure leaf",
    "<root><p>Hello</p></root>",
    (result) => {
      const pEntry = result[0]["root"][0];
      // leaf text goes into children, not sibling text property
      expect(pEntry.text).toBeUndefined();
      expect(pEntry["p"][0]["#text"]).toBe("Hello");
    },
    makeOptions({ tags: { valueParsers: [] }, textInChild: true })
  );

  runAcrossAllInputSources(
    "textInChild: true — mixed content still works, all text goes into children",
    "<root><p>before<b>bold</b>after</p></root>",
    (result) => {
      const p = result[0]["root"][0]["p"];
      expect(p[0]["#text"]).toBe("before");
      expect(Array.isArray(p[1]["b"])).toBe(true);
      expect(p[2]["#text"]).toBe("after");
    },
    makeOptions({ tags: { valueParsers: [] }, textInChild: true })
  );

  runAcrossAllInputSources(
    "nameFor.text changes the key used for inline text in mixed content",
    "<root><p>Hello <b>world</b></p></root>",
    (result) => {
      const p = result[0]["root"][0]["p"];
      expect(p[0]["_t"]).toBe("Hello ");
    },
    makeOptions({ nameFor: { text: "_t" }, tags: { valueParsers: [] } })
  );

});


// =============================================================================
// 6. Comments
// =============================================================================
describe("SequentialBuilder - comments", function () {

  runAcrossAllInputSources(
    "comments are omitted when nameFor.comment is not set (default)",
    `<root><!--A comment--><tag>value</tag></root>`,
    (result) => {
      const children = result[0]["root"];
      expect(children.length).toBe(1);
      expect(children[0]["tag"]).toBeDefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "comments appear as { '#comment': text } entries when nameFor.comment is set",
    `<root><!--Hello--><tag>value</tag></root>`,
    (result) => {
      const children = result[0]["root"];
      const comment = children.find(c => c["#comment"] !== undefined);
      expect(comment).toBeDefined();
      expect(comment["#comment"]).toBe("Hello");
    },
    makeOptions({ nameFor: { comment: "#comment" } })
  );

  runAcrossAllInputSources(
    "comments appear in document order with sibling elements",
    `<root><!--c1--><a>1</a><!--c2--></root>`,
    (result) => {
      const children = result[0]["root"];
      expect(children[0]["#comment"]).toBe("c1");
      expect(children[1]["a"]).toBeDefined();
      expect(children[2]["#comment"]).toBe("c2");
    },
    makeOptions({ nameFor: { comment: "#comment" } })
  );

  runAcrossAllInputSources(
    "skip.comment: true omits comments even when nameFor.comment is set",
    `<root><!--hidden--><tag>v</tag></root>`,
    (result) => {
      const children = result[0]["root"];
      const hasComment = children.some(c => c["#comment"] !== undefined);
      expect(hasComment).toBe(false);
    },
    makeOptions({ nameFor: { comment: "#comment" } }, { skip: { comment: true } })
  );

});


// =============================================================================
// 7. CDATA
// =============================================================================
describe("SequentialBuilder - CDATA", function () {

  runAcrossAllInputSources(
    "CDATA without nameFor.cdata merges into leaf text",
    "<root><code><![CDATA[data]]></code></root>",
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry.text).toBe("data");
      expect(entry["code"]).toEqual([]);
    },
    makeOptions({ tags: { valueParsers: [] } }, { skip: { cdata: false } })
  );

  runAcrossAllInputSources(
    "CDATA with nameFor.cdata appears as { [cdata]: text } entry in children",
    "<root><code><![CDATA[data]]></code></root>",
    (result) => {
      const children = result[0]["root"][0]["code"];
      expect(children[0]["##cdata"]).toBe("data");
    },
    makeOptions({ nameFor: { cdata: "##cdata" } }, { skip: { cdata: false } })
  );

  runAcrossAllInputSources(
    "skip.cdata: true removes CDATA content entirely",
    "<root><tag><![CDATA[content]]></tag></root>",
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry["tag"]).toEqual([]);
      expect(entry.text).toBeUndefined();
    },
    makeOptions({}, { skip: { cdata: true } })
  );

});


// =============================================================================
// 8. Processing instructions
// =============================================================================
describe("SequentialBuilder - processing instructions", function () {

  runAcrossAllInputSources(
    "processing instruction appears as an entry with the PI name as key",
    `<?xml version="1.0"?><root/>`,
    (result) => {
      expect(Array.isArray(result)).toBe(true);
      // declaration creates an entry; root is also present
      expect(result.length).toBeGreaterThanOrEqual(2);
    },
    makeOptions()
  );

});


// =============================================================================
// 9. Stop nodes
// =============================================================================
describe("SequentialBuilder - stop nodes", function () {

  runAcrossAllInputSources(
    "stop node raw content is stored as 'text' sibling on the entry",
    "<root><script>let x = 1;</script></root>",
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry["script"]).toEqual([]);
      expect(entry.text).toBe("let x = 1;");
    },
    makeOptions({}, { tags: { stopNodes: ["*.script"] } })
  );

  runAcrossAllInputSources(
    "stop node with nested XML preserved as raw string in text property",
    "<root><raw><b>bold</b></raw></root>",
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry.text).toContain("<b>bold</b>");
    },
    makeOptions({}, { tags: { stopNodes: ["..raw"] } })
  );

  runAcrossAllInputSources(
    "multiple stop nodes each become an entry with raw text property",
    "<root><a>raw1</a><b>raw2</b></root>",
    (result) => {
      const children = result[0]["root"];
      expect(children[0].text).toContain("raw1");
      expect(children[1].text).toContain("raw2");
    },
    makeOptions({}, { tags: { stopNodes: ["*.a", "*.b"] } })
  );

  runAcrossAllInputSources(
    "wildcard (..) stop node matches at any depth",
    "<root><div><script>code</script></div></root>",
    (result) => {
      const div = result[0]["root"][0];
      const script = div["div"][0];
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
describe("SequentialBuilder - nameFor overrides", function () {

  runAcrossAllInputSources(
    "nameFor.comment changes the key for comment entries",
    `<root><!--hello--></root>`,
    (result) => {
      const children = result[0]["root"];
      expect(children[0]["##"]).toBe("hello");
    },
    makeOptions({ nameFor: { comment: "##" } })
  );

  runAcrossAllInputSources(
    "nameFor.cdata changes the key for CDATA entries in children",
    "<root><code><![CDATA[data]]></code></root>",
    (result) => {
      const children = result[0]["root"][0]["code"];
      expect(children[0]["##cdata"]).toBe("data");
    },
    makeOptions({ nameFor: { cdata: "##cdata" } }, { skip: { cdata: false } })
  );

  runAcrossAllInputSources(
    "nameFor.text changes the key used for inline text in mixed content",
    "<root><p>Hello <b>world</b></p></root>",
    (result) => {
      const p = result[0]["root"][0]["p"];
      expect(p[0]["_"]).toBe("Hello ");
    },
    makeOptions({ nameFor: { text: "_" }, tags: { valueParsers: [] } })
  );

});


// =============================================================================
// 11. skip options
// =============================================================================
describe("SequentialBuilder - skip options", function () {

  runAcrossAllInputSources(
    "skip.attributes: true (default) — no attributes property on entries",
    `<root><item id="1" class="a">x</item></root>`,
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry.attributes).toBeUndefined();
    },
    makeOptions({}, { skip: { attributes: true } })
  );

  runAcrossAllInputSources(
    "skip.cdata: true — CDATA sections removed, no text on entry either",
    "<root><tag><![CDATA[content]]></tag></root>",
    (result) => {
      const entry = result[0]["root"][0];
      expect(entry["tag"]).toEqual([]);
      expect(entry.text).toBeUndefined();
    },
    makeOptions({}, { skip: { cdata: true } })
  );

  runAcrossAllInputSources(
    "skip.comment: true — no comment entries in children",
    `<root><!--comment--><tag>v</tag></root>`,
    (result) => {
      const children = result[0]["root"];
      const hasComment = children.some(c => c["#comment"] !== undefined);
      expect(hasComment).toBe(false);
    },
    makeOptions({ nameFor: { comment: "#comment" } }, { skip: { comment: true } })
  );

});


// =============================================================================
// 12. onClose callback
// =============================================================================
describe("SequentialBuilder - onClose callback", function () {

  it("onClose receives the node object before it is converted and added", function () {
    const names = [];
    const parser = new XMLParser(makeOptions({
      onClose(node) {
        names.push(node.tagname);
      }
    }));
    parser.parse("<root><a>1</a><b>2</b></root>");
    expect(names).toContain("a");
    expect(names).toContain("b");
    expect(names).toContain("root");
  });

  it("onClose returning truthy suppresses the entry from being added to parent", function () {
    const parser = new XMLParser(makeOptions({
      onClose(node) {
        if (node.tagname === "a") return true;
      }
    }));
    const result = parser.parse("<root><a>1</a><b>2</b></root>");
    const children = result[0]["root"];
    const hasA = children.some(c => c["a"] !== undefined);
    const hasB = children.some(c => c["b"] !== undefined);
    expect(hasA).toBe(false);
    expect(hasB).toBe(true);
  });

  it("onClose returning falsy allows the entry to be added normally", function () {
    const parser = new XMLParser(makeOptions({
      onClose(node) { return false; }
    }));
    const result = parser.parse("<root><a>1</a></root>");
    expect(result[0]["root"][0]["a"]).toBeDefined();
  });

  runAcrossAllInputSourcesWithFactory(
    "onClose suppressing all children leaves root with empty children array",
    "<root><a>1</a><b>2</b></root>",
    (result) => {
      expect(result[0]["root"]).toEqual([]);
    },
    () => new XMLParser(makeOptions({
      onClose(node) {
        if (node.tagname !== "root") return true;
      }
    }))
  );

  it("onClose receives node with text property set for leaf nodes", function () {
    const collected = [];
    const parser = new XMLParser(makeOptions({
      onClose(node) {
        collected.push({ name: node.tagname, text: node.text });
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
describe("SequentialBuilder - deeply nested and complex structures", function () {

  runAcrossAllInputSources(
    "5-level deep nesting is handled correctly",
    "<a><b><c><d><e>deep</e></d></c></b></a>",
    (result) => {
      const a = result[0]["a"];
      const b = a[0]["b"];
      const c = b[0]["c"];
      const d = c[0]["d"];
      const eEntry = d[0];
      expect(eEntry["e"]).toEqual([]);
      expect(eEntry.text).toBe("deep");
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "sibling and nested repetition of the same tag name works",
    "<root><item><sub>1</sub></item><item><sub>2</sub></item></root>",
    (result) => {
      const items = result[0]["root"];
      expect(items.length).toBe(2);
      expect(items[0]["item"][0].text).toBe(1);
      expect(items[1]["item"][0].text).toBe(2);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "text and element children can be interleaved at any depth",
    "<root><p>text<b>bold</b>more</p></root>",
    (result) => {
      const p = result[0]["root"][0]["p"];
      expect(p[0]["#text"]).toBe("text");
      expect(p[1]["b"]).toBeDefined();
      expect(p[2]["#text"]).toBe("more");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

});


// =============================================================================
// 14. Document-order preservation
// =============================================================================
describe("SequentialBuilder - document order preservation", function () {

  runAcrossAllInputSources(
    "sibling elements appear in document order",
    "<root><first>1</first><second>2</second><third>3</third></root>",
    (result) => {
      const children = result[0]["root"];
      expect(children[0]["first"]).toBeDefined();
      expect(children[1]["second"]).toBeDefined();
      expect(children[2]["third"]).toBeDefined();
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "repeated same-name siblings appear in document order",
    "<root><item>a</item><item>b</item><item>c</item></root>",
    (result) => {
      const items = result[0]["root"];
      expect(items.length).toBe(3);
      expect(items[0].text).toBe("a");
      expect(items[1].text).toBe("b");
      expect(items[2].text).toBe("c");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "interleaved comments and elements preserve order",
    `<root><!--c1--><a>1</a><!--c2--><b>2</b><!--c3--></root>`,
    (result) => {
      const children = result[0]["root"];
      expect(children[0]["#comment"]).toBe("c1");
      expect(children[1]["a"]).toBeDefined();
      expect(children[2]["#comment"]).toBe("c2");
      expect(children[3]["b"]).toBeDefined();
      expect(children[4]["#comment"]).toBe("c3");
    },
    makeOptions({ nameFor: { comment: "#comment" } })
  );

  runAcrossAllInputSources(
    "deeply nested structure preserves element order at each level",
    "<root><a><x>1</x><y>2</y></a><b><x>3</x><y>4</y></b></root>",
    (result) => {
      const a = result[0]["root"][0]["a"];
      expect(a[0]["x"]).toBeDefined();
      expect(a[1]["y"]).toBeDefined();
      const b = result[0]["root"][1]["b"];
      expect(b[0]["x"]).toBeDefined();
      expect(b[1]["y"]).toBeDefined();
    },
    makeOptions()
  );

});


// =============================================================================
// 15. Custom value parsers
// =============================================================================
describe("SequentialBuilder - custom value parsers", function () {

  runAcrossAllInputSources(
    "empty valueParsers array keeps all values as raw strings",
    "<root><n>42</n><b>true</b></root>",
    (result) => {
      const children = result[0]["root"];
      expect(children[0].text).toBe("42");
      expect(children[1].text).toBe("true");
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "trim parser in chain removes surrounding whitespace",
    "<root><tag>  trimmed  </tag></root>",
    (result) => {
      expect(result[0]["root"][0].text).toBe("trimmed");
    },
    makeOptions({ tags: { valueParsers: ["trim", "boolean", "number"] } })
  );

});


// =============================================================================
// 16. Full snapshot tests
// =============================================================================
describe("SequentialBuilder - full snapshot tests", function () {

  runAcrossAllInputSources(
    "README example: root with two leaf children produces correct sequential array",
    "<root><child>hello</child><child>world</child></root>",
    (result) => {
      const expected = [
        {
          root: [
            { child: [], text: "hello" },
            { child: [], text: "world" },
          ],
        },
      ];
      expect(plain(result)).toEqual(expected);
    },
    makeOptions({}, { tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "attribute example: attributes as sibling property alongside tag key",
    `<root><item id="1">hello</item></root>`,
    (result) => {
      const expected = [
        {
          root: [
            { item: [], attributes: { "@_id": 1 }, text: "hello" },
          ],
        },
      ];
      expect(plain(result)).toEqual(expected);
    },
    makeOptions({}, { skip: { attributes: false } })
  );

  runAcrossAllInputSources(
    "empty tag snapshot: no text property, empty children array",
    "<root><br/></root>",
    (result) => {
      const expected = [
        {
          root: [
            { br: [] },
          ],
        },
      ];
      expect(plain(result)).toEqual(expected);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "mixed content snapshot",
    "<root><p>Hello <b>world</b>!</p></root>",
    (result) => {
      const expected = [
        {
          root: [
            {
              p: [
                { "#text": "Hello " },
                { b: [], text: "world" },
                { "#text": "!" },
              ],
            },
          ],
        },
      ];
      expect(plain(result)).toEqual(expected);
    },
    makeOptions({ tags: { valueParsers: [] } })
  );

  runAcrossAllInputSources(
    "nested structure snapshot",
    "<root><a><b>1</b><c>two</c></a></root>",
    (result) => {
      const expected = [
        {
          root: [
            {
              a: [
                { b: [], text: 1 },
                { c: [], text: "two" },
              ],
            },
          ],
        },
      ];
      expect(plain(result)).toEqual(expected);
    },
    makeOptions()
  );

  runAcrossAllInputSources(
    "attributes + text + children all coexist correctly",
    `<root><section id="main"><p>intro</p><p>body</p></section></root>`,
    (result) => {
      const section = result[0]["root"][0];
      expect(section.attributes["@_id"]).toBe("main");
      expect(section["section"].length).toBe(2);
      expect(section.text).toBeUndefined();
    },
    makeOptions({}, { skip: { attributes: false }, tags: { valueParsers: [] } })
  );

});
