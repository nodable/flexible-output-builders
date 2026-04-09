import XMLParser from "@nodable/flexible-xml-parser";
import SequentialStreamBuilderFactory, { SequentialStreamBuilder } from "../src/SequentialStreamBuilder.js"
import SequentialBuilderFactory from "../../SequentialBuilder/src/SequentialBuilder.js"
// const __dirname = dirname(fileURLToPath(import.meta.url));

import fs from "fs";
// import path from "path";
// const fileNamePath = path.join(__dirname, "./assets/ptest.xml");//with CDATA

describe("Sequential Stream Builder", () => {
  // const xmlData = `<?comment attr="34" ?><a/>`;
  // const xmlData = `<a/>`;
  // const xmlData = `<a>text</a>`;
  // const xmlData = `<a b="val">text</a>`; //{"a":{"b":"val","#text":"text"}}
  // const xmlData = `<root><empty/></root>`; // {empty: '' }
  // const xmlData = `<root><empty></empty></root>`; // {empty: '' }
  // const xmlData = `<root><empty>a</empty></root>`; // {"empty":"a"}
  // const xmlData = `<root arg="test"><empty>a</empty></root>`; // {"empty":"a"}
  const xmlData = `<root arg="test">text<empty>a</empty></root>`; // {"empty":"a","#text":"text"}
  // const xmlData = `<a b="val">text`; //auto close
  // const xmlData = `<a b="val">text<![CDATA[cdata]]>text2</a>`;
  it("stream", (done) => {
    const outStream = fs.createWriteStream('output.json');

    outStream.on('error', (err) => {
      console.log('Stream error:', err);
      done(err);
    });

    // FIX: wait for the stream to be open before parsing.
    // parser.parse() is synchronous — it calls onChunk() inline while running.
    // If the file handle isn't open yet, stream.write() silently loses the data.
    outStream.on('open', () => {
      const parser = new XMLParser({
        skip: {
          attributes: false,
          cdata: false
        },
        nameFor: {
          cdata: "cdata"
        },
        // autoClose: { onEof: 'closeAll', collectErrors: true },
        OutputBuilder: new SequentialStreamBuilderFactory({
          stream: outStream,
          // onChunk: (chunk) => {
          //   console.log('CHUNK EMITTED:', chunk);
          //   outStream.write(chunk);
          // }
        })
      });

      parser.parse(xmlData);

      // End the stream after parsing is fully done (parse() is synchronous,
      // so all onChunk calls have already fired by the time we reach here).
      outStream.end(() => {
        console.log('Stream finished — check output.json');
        done();
      });
    });
  });
  it("fixed", () => {
    const parser = new XMLParser({
      skip: {
        attributes: false,
        cdata: false
      },
      nameFor: {
        cdata: "cdata"
      },
      // autoClose: { onEof: 'closeAll', collectErrors: true },
      OutputBuilder: new SequentialBuilderFactory({})
    });



    const result = parser.parse(xmlData);
    console.log(JSON.stringify(result, null, 2))

  });
});
