import { COMMENT_NODE, DOCTYPE_NODE, DOCUMENT_NODE, ELEMENT_NODE, TEXT_NODE } from "ultrahtml"


export { parse as htmlParse, render as htmlRender, transform as htmlTransform, walk as htmlWalk, type Node as HtmlNode } from "ultrahtml"

export const enum HTML_NODE_TYPE {
	DOCUMENT = DOCUMENT_NODE,
	ELEMENT = ELEMENT_NODE,
	TEXT = TEXT_NODE,
	COMMENT = COMMENT_NODE,
	DOCTYPE = DOCTYPE_NODE,
}

export type StrictOmit<T, K extends keyof T> = Omit<T, K>
