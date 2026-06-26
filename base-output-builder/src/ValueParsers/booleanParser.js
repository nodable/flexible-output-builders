import BaseValueParser from "./BaseValueParser.js";
import { FinalValue } from "../ValueParser.js";

export default class boolParser extends BaseValueParser {
    constructor(trueList, falseList, isFinal = false) {
        super(isFinal)
        if (trueList)
            this.trueList = trueList;
        else
            this.trueList = ["true"];

        if (falseList)
            this.falseList = falseList;
        else
            this.falseList = ["false"];
    }
    parse(val) {
        if (typeof val === 'string') {
            //TODO: performance: don't convert
            const temp = val.toLowerCase();
            if (this.trueList.indexOf(temp) !== -1) return this.IS_FINAL ? new FinalValue(true) : true;
            else if (this.falseList.indexOf(temp) !== -1) return this.IS_FINAL ? new FinalValue(false) : false;
        }
        return val;
    }
}
