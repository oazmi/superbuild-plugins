import { COMMENT_NODE, DOCTYPE_NODE, DOCUMENT_NODE, ELEMENT_NODE, TEXT_NODE } from "ultrahtml";
export { parse as htmlParse, render as htmlRender, transform as htmlTransform, walk as htmlWalk } from "ultrahtml";
export var HTML_NODE_TYPE;
(function (HTML_NODE_TYPE) {
    HTML_NODE_TYPE[HTML_NODE_TYPE["DOCUMENT"] = 0] = "DOCUMENT";
    HTML_NODE_TYPE[HTML_NODE_TYPE["ELEMENT"] = 1] = "ELEMENT";
    HTML_NODE_TYPE[HTML_NODE_TYPE["TEXT"] = 2] = "TEXT";
    HTML_NODE_TYPE[HTML_NODE_TYPE["COMMENT"] = 3] = "COMMENT";
    HTML_NODE_TYPE[HTML_NODE_TYPE["DOCTYPE"] = 4] = "DOCTYPE";
})(HTML_NODE_TYPE || (HTML_NODE_TYPE = {}));
