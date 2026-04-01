
import EntitiesValueParser from "../src/ValueParsers/EntityParser/EntitiesValueParser.js"

describe("Entity Parser", function () {

  it("addEntity with bad value throws ParseError", function () {
    const entityParser = new EntitiesValueParser();
    expect(() => entityParser.addEntity("ok", "val&bad"))
      .toThrowError("Entity value must be a string and must not contain '&'");

  });

  it("addEntity with bad key throws ParseError", function () {
    const entityParser = new EntitiesValueParser();

    expect(() => entityParser.addEntity("&bad", "val"))
      .toThrowError("Entity key must not contain '&' or ';'. E.g. use 'copy' for '&copy;'");

  });
});