import XMLParser from "@solothought/flexible-xml-parser";
import NodeTreeBuilderFactory from "../src/NodeTreeBuilder.js";

describe("NodeTreeBuilder", () => {
  it("should compact leaf nodes", () => {
    const parser = new XMLParser({
      OutputBuilder: new NodeTreeBuilderFactory({
        // compactLeaf: true
      }),
      skip: { comments: false, declaration: false, attributes: false },
      nameFor: { comment: "#comment" }
    });

    const xmlData = `<?comment attr="34" ?><a/>`;

    const result = parser.parse(xmlData);
    console.log(JSON.stringify(result, null, 2));
  });
});
