import XMLParser from "@nodable/flexible-xml-parser";
import CompactBuilderFactory from "../src/CompactBuilder.js";
import { Expression } from "path-expression-matcher";


describe("NodeTreeBuilder", () => {
  it("should compact leaf nodes", () => {
    const parser = new XMLParser({
      OutputBuilder: new CompactBuilderFactory({
      }),
      skip: { comments: false, declaration: false, attributes: false },
      nameFor: { comment: "#comment" }
    });

    const xmlData = `<?comment attr="34" ?><a/>`;

    const result = parser.parse(xmlData);
    console.log(JSON.stringify(result, null, 2));
  });
  fit("should compact leaf nodes", () => {
    const inputXml = `<root><item>Value</item></root>`;

    const parser = new XMLParser({
      OutputBuilder: new CompactBuilderFactory({
        forceTextNode: true //false by default
      }),
    });

    const result = parser.parse(inputXml);
    console.log(JSON.stringify(result, null, 2));
  });
});
