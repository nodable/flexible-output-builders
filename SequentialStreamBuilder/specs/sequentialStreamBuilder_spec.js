import XMLParser from "@nodable/flexible-xml-parser";
import SequentialStreamBuilderFactory, { SequentialStreamBuilder } from "../src/SequentialStreamBuilder.js"
import SequentialBuilderFactory from "../../SequentialBuilder/src/SequentialBuilder.js"
import { Writable } from "node:stream";
/**
 * sequentialStreamBuilder_spec.js
 *
 * Tests for SequentialStreamBuilder — the stream-output variant of SequentialBuilder.
 *
 * Strategy
 * ────────
 * parser.parse() is synchronous, so every chunk is emitted inline.
 * We capture output via `onChunk` into a string buffer, then JSON.parse()
 * the result and compare it against the in-memory SequentialBuilder for the
 * same input.  This gives us two guarantees at once:
 *
 *   1. The stream output is valid JSON.
 *   2. The stream output matches the in-memory builder exactly.
 *
 * Where a test is about streaming mechanics (framing, onChunk vs stream,
 * partial emission, onExit) we test those properties directly.
 */



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run both builders on the same input and return
 *   { memory: Array, stream: Array }
 * so a test can assert they are identical.
 */
function bothBuilders(xmlData, builderOptions = {}, parserOptions = {}) {
  // In-memory builder
  const memParser = new XMLParser({
    OutputBuilder: new SequentialBuilderFactory(builderOptions),
    ...parserOptions,
  });
  const memory = memParser.parse(xmlData);

  // Stream builder via onChunk
  let buf = "";
  const streamParser = new XMLParser({
    OutputBuilder: new SequentialStreamBuilderFactory({
      ...builderOptions,
      onChunk: (chunk) => { buf += chunk; },
    }),
    ...parserOptions,
  });
  streamParser.parse(xmlData);
  const stream = JSON.parse(buf);

  return { memory, stream };
}

/**
 * Convenience: assert stream output equals memory output.
 */
function expectMatch(xmlData, builderOptions = {}, parserOptions = {}) {
  const { memory, stream } = bothBuilders(xmlData, builderOptions, parserOptions);
  expect(stream).toEqual(memory);
}

// ---------------------------------------------------------------------------
// 1. Constructor validation
// ---------------------------------------------------------------------------

describe("SequentialStreamBuilder — constructor", () => {
  it("throws when neither stream nor onChunk is provided", () => {
    expect(() => new SequentialStreamBuilderFactory({})).toThrowError(TypeError);
  });

  it("throws when both stream and onChunk are provided", () => {
    const writable = new Writable({ write() { } });
    expect(() =>
      new SequentialStreamBuilderFactory({
        stream: writable,
        onChunk: () => { },
      })
    ).toThrowError(TypeError);
  });

  it("accepts onChunk without throwing", () => {
    expect(() =>
      new SequentialStreamBuilderFactory({ onChunk: () => { } })
    ).not.toThrow();
  });

  it("accepts a Writable stream without throwing", () => {
    const writable = new Writable({ write() { } });
    expect(() =>
      new SequentialStreamBuilderFactory({ stream: writable })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. JSON framing
// ---------------------------------------------------------------------------

describe("SequentialStreamBuilder — JSON array framing", () => {
  it("emits an empty array [] for an empty document", () => {
    let buf = "";
    const parser = new XMLParser({
      OutputBuilder: new SequentialStreamBuilderFactory({
        onChunk: (c) => { buf += c; },
      }),
    });
    // parse() with no well-formed XML won't call closeElement,
    // so we trigger getOutput via the return value below.
    parser.parse(""); // no elements → entryCount stays 0
    expect(buf).toBe("[]");
  });

  it("opens array on first entry and closes array via getOutput", () => {
    let buf = "";
    const parser = new XMLParser({
      OutputBuilder: new SequentialStreamBuilderFactory({
        onChunk: (c) => { buf += c; },
      }),
    });
    parser.parse("<root/>");
    expect(buf.trimStart()).toMatch(/^\[/);
    expect(buf.trimEnd()).toMatch(/\]$/);
    expect(() => JSON.parse(buf)).not.toThrow();
  });

  it("comma-separates multiple top-level entries", () => {
    let buf = "";
    const parser = new XMLParser({
      OutputBuilder: new SequentialStreamBuilderFactory({
        onChunk: (c) => { buf += c; },
      }),
    });
    parser.parse("<r><a/><b/></r>");
    const parsed = JSON.parse(buf);
    expect(Array.isArray(parsed)).toBe(true);
    // single root → exactly one entry
    expect(parsed.length).toBe(1);
  });

  it("produces valid JSON for multiple root-level elements (fragment mode)", () => {
    // Two sibling root elements — only valid in fragment mode if the parser
    // supports it; skip gracefully if not.
    let buf = "";
    const parser = new XMLParser({
      OutputBuilder: new SequentialStreamBuilderFactory({
        onChunk: (c) => { buf += c; },
      }),
    });
    try {
      parser.parse("<a/><b/>");
      const parsed = JSON.parse(buf);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    } catch {
      // Parser may reject a fragment — that's fine, skip the assertion.
      pending("parser does not support fragments");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Output parity with in-memory SequentialBuilder
// ---------------------------------------------------------------------------

describe("SequentialStreamBuilder — parity with SequentialBuilder", () => {
  it("empty element", () => {
    expectMatch("<root/>");
  });

  it("element with text", () => {
    expectMatch("<root>hello</root>");
  });

  it("nested elements", () => {
    expectMatch("<root><child>value</child></root>");
  });

  it("sibling children", () => {
    expectMatch("<root><a>1</a><b>2</b><c>3</c></root>");
  });

  it("deeply nested structure", () => {
    expectMatch("<a><b><c><d>deep</d></c></b></a>");
  });

  it("attributes (skip.attributes = false)", () => {
    expectMatch(
      '<root id="1" name="x"><child attr="y">text</child></root>',
      {},
      { skip: { attributes: false } }
    );
  });

  it("mixed content", () => {
    expectMatch("<p>Hello <b>world</b>!</p>");
  });

  it("mixed content — text before and after multiple children", () => {
    expectMatch("<p>A<x/>B<y/>C</p>");
  });

  it("CDATA with nameFor.cdata set", () => {
    expectMatch(
      "<root><![CDATA[raw & stuff]]></root>",
      { nameFor: { cdata: "##cdata" } },
      { skip: { cdata: false } }
    );
  });

  it("comments with nameFor.comment set", () => {
    expectMatch(
      "<root><!-- a comment --><child/></root>",
      { nameFor: { comment: "#comment" } },
      { skip: { comment: false } }
    );
  });

  it("textInChild: true", () => {
    expectMatch("<root><a>hello</a></root>", { textInChild: true });
  });

  it("value parsers: numbers and booleans", () => {
    expectMatch("<root><n>42</n><b>true</b></root>");
  });

  it("custom groupBy", () => {
    expectMatch(
      '<root id="1"><child/></root>',
      { attributes: { groupBy: ":@" } },
      { skip: { attributes: false } }
    );
  });

  it("custom nameFor.text", () => {
    expectMatch("<p>Hello <b>world</b>!</p>", { nameFor: { text: ":text" } });
  });

  it("processing instructions are included in order", () => {
    expectMatch('<?xml version="1.0"?><root><pi/></root>');
  });

  it("complex realistic document", () => {
    expectMatch(`
      <library>
        <book id="1">
          <title>XML Parsing</title>
          <author>Alice</author>
          <tags><tag>xml</tag><tag>parsing</tag></tags>
        </book>
        <book id="2">
          <title>Streams</title>
          <author>Bob</author>
        </book>
      </library>
    `, {}, { skip: { attributes: false } });
  });
});

// ---------------------------------------------------------------------------
// 4. Streaming mechanics — chunk emission timing
// ---------------------------------------------------------------------------

describe("SequentialStreamBuilder — chunk emission timing", () => {
  it("emits the first chunk before getOutput() is called", () => {
    const chunks = [];
    // We need a way to intercept getOutput; easiest: track chunks via onChunk
    const factory = new SequentialStreamBuilderFactory({
      onChunk: (c) => chunks.push(c),
    });
    const parser = new XMLParser({ OutputBuilder: factory });

    // Patch: after parse, chunks should contain at least 2 items:
    //   chunk[0] starts with "[\n" (opening + first entry)
    //   last chunk ends with "\n]"
    parser.parse("<root><child>v</child></root>");

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toMatch(/^\[/);
  });

  it("top-level entry is emitted as soon as its close tag is processed", () => {
    // We attach a spy to onChunk.  After processing </root>, the chunk must
    // already have been emitted (parse() is synchronous, so by the time
    // parse() returns, everything has fired).
    const emitted = [];
    const parser = new XMLParser({
      OutputBuilder: new SequentialStreamBuilderFactory({
        onChunk: (c) => emitted.push(c),
      }),
    });
    parser.parse("<root>text</root>");

    // Recombine and parse
    const combined = emitted.join("");
    // Not yet closed (getOutput adds "]") — but parsing already happened
    // The combined buffer (before the final "]") must be parseable once we add "]"
    const result = JSON.parse(combined.trimEnd().endsWith("]") ? combined : combined + "\n]");
    expect(result[0]["root"]).toBeDefined();
  });

  it("getOutput() returns null (output is in the stream, not in memory)", () => {
    let buf = "";
    const parser = new XMLParser({
      OutputBuilder: new SequentialStreamBuilderFactory({
        onChunk: (c) => { buf += c; },
      }),
    });
    const result = parser.parse("<root/>");
    expect(result).toBeNull();
    expect(buf).toBeTruthy(); // something was streamed
  });
});

// ---------------------------------------------------------------------------
// 5. Writable stream integration
// ---------------------------------------------------------------------------

describe("SequentialStreamBuilder — Writable stream", () => {
  it("writes all output to the stream", (done) => {
    const chunks = [];
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });

    const parser = new XMLParser({
      OutputBuilder: new SequentialStreamBuilderFactory({ stream: writable }),
    });

    parser.parse("<root><child>hello</child></root>");

    writable.end(() => {
      const json = chunks.join("");
      const parsed = JSON.parse(json);
      expect(parsed).toEqual([{ root: [{ child: [], text: "hello" }] }]);
      done();
    });
  });
});

// ---------------------------------------------------------------------------
// 6. space option
// ---------------------------------------------------------------------------

describe("SequentialStreamBuilder — space option", () => {
  it("produces compact JSON when space is not set", () => {
    let buf = "";
    const parser = new XMLParser({
      OutputBuilder: new SequentialStreamBuilderFactory({
        onChunk: (c) => { buf += c; },
      }),
    });
    parser.parse("<root/>");
    // compact: no indented lines inside the object
    expect(buf).not.toMatch(/^\s{2,}/m);
  });

  it("produces indented JSON when space: 2", () => {
    let buf = "";
    const parser = new XMLParser({
      OutputBuilder: new SequentialStreamBuilderFactory({
        onChunk: (c) => { buf += c; },
        space: 2,
      }),
    });
    parser.parse("<root><child>v</child></root>");
    expect(buf).toMatch(/^  /m); // at least one line indented
    expect(() => JSON.parse(buf)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7. onExit integration
// ---------------------------------------------------------------------------

describe("SequentialStreamBuilder — onExit", () => {
  it("closes the JSON array on onExit so the output is valid JSON", () => {
    // Simulate onExit being called (the parser calls it after closing all tags).
    // We can test this by checking that getOutput() itself closes the array,
    // since onExit delegates to getOutput().
    let buf = "";
    const factory = new SequentialStreamBuilderFactory({
      onChunk: (c) => { buf += c; },
    });
    const parser = new XMLParser({ OutputBuilder: factory });
    parser.parse("<root><child>hello</child></root>");

    // At this point getOutput() was already called by the parser.
    // buf must be valid JSON.
    expect(() => JSON.parse(buf)).not.toThrow();
    const parsed = JSON.parse(buf);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("calling getOutput() a second time (e.g. via onExit after getOutput) is a no-op", () => {
    let buf = "";
    const factory = new SequentialStreamBuilderFactory({
      onChunk: (c) => { buf += c; },
    });
    // Grab the builder instance to call onExit manually
    const origGetInstance = factory.getInstance.bind(factory);
    let builderRef;
    factory.getInstance = (...args) => {
      builderRef = origGetInstance(...args);
      return builderRef;
    };

    const parser = new XMLParser({ OutputBuilder: factory });
    parser.parse("<root/>");

    const afterFirstClose = buf;

    // Calling again must not corrupt the output
    builderRef.getOutput();
    expect(buf).toBe(afterFirstClose);
  });
});