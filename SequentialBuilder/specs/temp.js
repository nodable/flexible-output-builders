import XMLParser from "@solothought/flexible-xml-parser";
import SequentialBuilderFactory from "../src/SequentialBuilder.js";

describe("SequentialBuilder", () => {
  it("should compact leaf nodes", () => {
    const parser = new XMLParser({
      OutputBuilder: new SequentialBuilderFactory({
        compactLeaf: true
      }),
      skip: { attributes: false }
    });

    const xmlData = `<root><a>value</a><b att="tr">value</b></root>`;

    const result = parser.parse(xmlData);
    console.log(JSON.stringify(result, null, 2));
  });
});
