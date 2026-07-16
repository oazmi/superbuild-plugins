/** @module */

import type { EsbuildPartialMessage, ImportedEntity, ImportEntity, OnTransformOptions, SuperPluginBuild, SuperPluginSetup } from "../../deps.ts"
import { contentsToString, isNull, isRecord } from "../../deps.ts"
import { htmlParse, htmlRender, htmlWalk, type HtmlNode } from "./deps.ts"
import { scriptLinkHandlerCallback, scriptLinkHandlerFilter } from "./node_handlers/script_link.ts"
import type { HtmlDependencyCallback, HtmlDependencyEmitData, HtmlDependencyFilter, HtmlNodeRef, HtmlNodeReplacementContentTask } from "./typedefs.ts"


const config = {
	transformFilter: {
		filter: /.*/,
		loader: "html",
		namespace: undefined,
	} satisfies OnTransformOptions
}

interface NodeHandlers {
	filter: HtmlDependencyFilter
	callback: HtmlDependencyCallback
}

export const htmlPluginSetup: SuperPluginSetup = async (build: SuperPluginBuild) => {
	const nodeHandlers: NodeHandlers[] = []
	nodeHandlers.push({ filter: scriptLinkHandlerFilter, callback: scriptLinkHandlerCallback })

	build.onTransform(config.transformFilter, async (args) => {
		const
			{ path: importer, namespace, resolveDir, pluginData } = args,
			contents = contentsToString(args.contents),
			html_doc: HtmlNode = htmlParse(contents),
			html_imports: Array<ImportEntity<HtmlNodeRef>> = []

		const
			resource_reinsertion_list: HtmlDependencyEmitData["replacementTaskList"] = [],
			emit_data: HtmlDependencyEmitData = {
				htmlDocument: html_doc,
				replacementTaskList: resource_reinsertion_list,
			}

		await htmlWalk(html_doc, async (node) => {
			for (const { filter, callback } of nodeHandlers) {
				if (filter.nodeType !== node.type) { continue }
				if ((filter.nodeName ?? false) && (filter.nodeName !== node.name)) { continue }
				if ((filter.nodeAttribute ?? false) && isRecord(node.attributes) && !(filter.nodeAttribute! in node.attributes)) { continue }
				const result = await callback({ htmlDocument: html_doc, htmlNode: node })
				if (isNull(result?.path)) { continue }

				let { path, replaceContent, external, with: with_attrs } = result
				const
					reinsertion_task: HtmlNodeReplacementContentTask = { htmlNode: node, replaceContent },
					key = resource_reinsertion_list.push(reinsertion_task) - 1
				if (!external) {
					const resolved = await build.resolve(path, {
						importer,
						namespace,
						kind: "import-statement",
						pluginData,
						resolveDir,
					})
					// TODO: if the resolved path is an empty string/undefined, should we `continue` to the next hook?
					// though, the result isn't going to change really if the next hook also extracts the same exact `path`...
					// TODO: merge errors and warnings.
					path = resolved.path
					external = resolved.external
				}
				html_imports.push({ key, path, external, with: with_attrs })
				break
			}
		})

		return {
			contents: "",
			loader: "copy",
			imports: html_imports,
			emitData: emit_data,
		}
	})

	build.onEmit({
		filter: /.*/,
		inputs: [{
			filter: /.*/,
			loader: "html",
		}],
	}, async (args) => {
		const
			number_of_sources = args.inputs.length,
			path = args.outputPath
		if (number_of_sources !== 1) {
			const error_text = `[htmlPlugin]: expected output html file to be constituted of just a single input html file, `
				+ `but found it to be made out of "${number_of_sources}" source files.`
				+ `input sources: [${args.inputs.map((input_file) => (input_file.namespace + ":" + input_file.path)).join("\n")}]`
			return { errors: [{ text: error_text, location: { file: path } }] }
		}
		const
			errors: EsbuildPartialMessage[] = [],
			{ htmlDocument, replacementTaskList } = args.inputs[0].emitData as HtmlDependencyEmitData
		for (const imported_entity of args.imports) {
			const
				{ key: node_ref, outputPath, external, write, with: with_attrs } = imported_entity as ImportedEntity<HtmlNodeRef>,
				reinsertion_task = replacementTaskList.at(node_ref)
			if (isNull(reinsertion_task)) {
				errors.push({
					text: `[htmlPlugin]: failed to find the "insertImport" function associated with the following html node number: "${node_ref}".`,
					location: { file: path },
				})
				continue
			}
			const { htmlNode: node, replaceContent } = replacementTaskList[node_ref]
			// TODO: resolve the `outputPath` as relative path if not external.
			// re-inserting the new link/reference back into the html node.
			replaceContent(node, outputPath, { external, write, with: with_attrs })
		}
		const rendered_html = await htmlRender(htmlDocument)
		return { contents: rendered_html, errors }
	})
}
