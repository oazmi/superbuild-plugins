export { parse as htmlParse, render as htmlRender, transform as htmlTransform, walk as htmlWalk, type Node as HtmlNode } from "ultrahtml";
export declare const enum HTML_NODE_TYPE {
    DOCUMENT = 0,
    ELEMENT = 1,
    TEXT = 2,
    COMMENT = 3,
    DOCTYPE = 4
}
export type StrictOmit<T, K extends keyof T> = Omit<T, K>;
//# sourceMappingURL=deps.d.ts.map