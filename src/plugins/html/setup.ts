/** the html plugin lets you bundle up html files, along side bundling any standard resource links that it might reference.
 *
 * @module
*/

import type { EsbuildPartialMessage, ImportedEntity, ImportEntity, OnEmitOptions, OnTransformOptions, Require, SuperPluginBuild, SuperPluginSetup } from "../../deps.ts"
import { contentsToString, isNull, isRecord, promise_all, relativePath } from "../../deps.ts"
import { ContentStore } from "./content_store.ts"
import { htmlParse, htmlRender, htmlWalk, type HtmlNode } from "./deps.ts"
import { scriptInlineHandler, scriptLinkHandler } from "./node_handlers/mod.ts"
import type { HtmlDependencyEmitData, HtmlNodeRef, HtmlNodeReplacementContentTask, NodeHandler, ReplaceContentFnContext } from "./typedefs.ts"


/** setup configuration options for the {@link htmlPluginSetup}.
 *
 * @defaultValue {@link defaultHtmlPluginSetupConfig}.
*/
export interface HtmlPluginSetupConfig {
	/** specify which loaded files/resoruces will need to be intercepted by the html plugin.
	 *
	 * @defaultValue `{ filter: new RegExp(".*"), loader: "html", namespace: undefined }`
	*/
	transformFilter?: Require<OnTransformOptions, "loader">

	/** specify your node handlers that will extract the linked/inlined resources that need to be bundled along with the html.
	 *
	 * @defaultValue all filters under [`./node_handlers/`](./node_handlers/) are included.
	*/
	nodeHandlers?: Array<NodeHandler>
}

/** the default configuration for {@link htmlPluginSetup}. */
export const defaultHtmlPluginSetupConfig: Required<HtmlPluginSetupConfig> = {
	transformFilter: { filter: /.*/, loader: "html", namespace: undefined },
	nodeHandlers: [
		scriptLinkHandler,
		scriptInlineHandler,
	],
}

/** the html plugin lets you bundle up html files, along side bundling any standard resource links that it might reference. */
export const htmlPluginSetup = (config?: HtmlPluginSetupConfig): SuperPluginSetup => {
	return (build: SuperPluginBuild) => htmlPluginSetupBase(build, config)
}

const htmlPluginSetupBase = (build: SuperPluginBuild, config?: HtmlPluginSetupConfig): ReturnType<SuperPluginSetup> => {
	const
		{ transformFilter, nodeHandlers } = { ...defaultHtmlPluginSetupConfig, ...config },
		emitFilter: OnEmitOptions = { filter: /.*/, inputs: [transformFilter] },
		contentStore = new ContentStore(build),
		replace_content_ctx: ReplaceContentFnContext = { contentStore }

	build.onTransform(transformFilter, async (args) => {
		const
			{ path: importer, namespace, resolveDir, pluginData } = args,
			contents = contentsToString(args.contents),
			html_doc: HtmlNode = htmlParse(contents),
			html_imports: Array<ImportEntity<HtmlNodeRef>> = [],
			warnings: EsbuildPartialMessage[] = [],
			errors: EsbuildPartialMessage[] = []

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
				const result = await callback({
					htmlDocument: html_doc,
					htmlNode: node,
					htmlPath: importer,
					htmlNamespace: namespace,
					contentStore,
				})
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
					warnings.push(...resolved.warnings)
					errors.push(...resolved.errors)
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
			warnings,
			errors,
		}
	})

	build.onEmit(emitFilter, async (args) => {
		const
			errors: EsbuildPartialMessage[] = [],
			number_of_sources = args.inputs.length,
			path = args.outputPath
		if (number_of_sources !== 1) {
			errors.push({
				location: { file: path },
				text: `[htmlPlugin]: expected output html file to be constituted of just a single input html file, `
					+ `but found it to be made out of "${number_of_sources}" source files.`
					+ `input sources: [${args.inputs.map((input_file) => (input_file.namespace + ":" + input_file.path)).join("\n")}]`
			})
			return { errors }
		}
		const { htmlDocument, replacementTaskList } = args.inputs[0].emitData as HtmlDependencyEmitData

		await promise_all(args.imports.map(async (imported_entity): Promise<void> => {
			const
				{ key: node_ref, outputPath, external, write, with: with_attrs } = imported_entity as ImportedEntity<HtmlNodeRef>,
				reinsertion_task = replacementTaskList.at(node_ref)
			if (isNull(reinsertion_task)) {
				errors.push({
					location: { file: path },
					text: `[htmlPlugin]: failed to find the "insertImport" function associated with the following html node number: "${node_ref}".`,
				})
				return
			}
			const { htmlNode: node, replaceContent } = replacementTaskList[node_ref]
			// now we resolve the `outputPath` as relative path if it is not an external path.
			const referenced_path = external
				? outputPath
				: relativePath(path, outputPath)
			// re-inserting the new link/reference back into the html node.
			await replaceContent(replace_content_ctx, node, referenced_path, { external, write, with: with_attrs })
		}))

		const rendered_html = await htmlRender(htmlDocument)
		return { contents: rendered_html, errors }
	})
}
