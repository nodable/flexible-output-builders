import BaseValueParser from "./BaseValueParser.js"
// import { FinalValue } from "./../ValueParser.js"

export default class trimmer extends BaseValueParser {
    parse(val) {
        if (typeof val === "string") return val.trim();
        else return val;
    }
}
