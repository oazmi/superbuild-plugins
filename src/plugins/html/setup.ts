/** the html plugin lets you bundle up html files, along side bundling any standard resource links that it might reference.
 *
 * @module
*/

import type { EsbuildPartialMessage, EsbuildResolveOptions, ImportedEntity, ImportEntity, OnEmitOptions, OnTransformOptions, Require, SuperPluginBuild, SuperPluginSetup } from "../../deps.ts"
import { contentsToString, isNull, isRecord, promise_all, relativePath } from "../../deps.ts"
import { ContentStore } from "./content_store.ts"
import { htmlParse, htmlRender, htmlWalk, type HtmlNode } from "./deps.ts"
import { pageLinkHandler, scriptInlineHandler, scriptLinkHandler, styleInlineHandler, styleLinkHandler } from "./node_handlers/mod.ts"
import type { HtmlDependencyArgs, HtmlDependencyCallback, HtmlDependencyEmitData, HtmlNodeReplacementContentTask, NodeHandler, ReplaceContentFnArgs, ReplaceContentFnContext } from "./typedefs.ts"


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
		pageLinkHandler,
		scriptLinkHandler,
		scriptInlineHandler,
		styleLinkHandler,
		styleInlineHandler,
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
		callback_ctx: Parameters<HtmlDependencyCallback>[1] = { build, contentStore }

	build.onTransform(transformFilter, async (args) => {
		const
			{ path: importer, namespace, resolveDir, pluginData } = args,
			contents = contentsToString(args.contents),
			html_doc: HtmlNode = htmlParse(contents),
			html_imports: Array<ImportEntity<HtmlNodeReplacementContentTask>> = [],
			warnings: EsbuildPartialMessage[] = [],
			errors: EsbuildPartialMessage[] = []

		const emit_data: HtmlDependencyEmitData = { htmlDocument: html_doc }

		await htmlWalk(html_doc, async (node) => {
			for (const { filter, callback } of nodeHandlers) {
				if (filter.nodeType !== node.type) { continue }
				if ((filter.nodeName ?? false) && (filter.nodeName !== node.name)) { continue }
				if ((filter.nodeAttribute ?? false) && isRecord(node.attributes) && !(filter.nodeAttribute! in node.attributes)) { continue }
				const args: HtmlDependencyArgs = {
					htmlDocument: html_doc,
					htmlNode: node,
					htmlPath: importer,
					htmlNamespace: namespace,
				}
				const result = await callback(args, callback_ctx)
				if (isNull(result?.path)) { continue }

				const
					{ path, replaceContent, handlerData, ...resolution_args } = result,
					reinsertion_task: HtmlNodeReplacementContentTask = { originalArgs: args, replaceContent, handlerData }
				type ValidResolutionArgs = (EsbuildResolveOptions extends typeof resolution_args ? true : false)
				// asserting that `resolution_args` strictly contains valid esbuild resolve args.
				const resolution_args_are_valid: ValidResolutionArgs = true
				html_imports.push({ key: reinsertion_task, path, ...resolution_args })
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

	build.onEmit(emitFilter, async (args, output_file_registry) => {
		const
			replace_content_ctx: ReplaceContentFnContext = { ...callback_ctx, outputs: output_file_registry },
			warnings: EsbuildPartialMessage[] = [],
			errors: EsbuildPartialMessage[] = [],
			number_of_sources = args.inputs.length,
			htmlOutputPath = args.outputPath
		if (number_of_sources !== 1) {
			errors.push({
				location: { file: htmlOutputPath },
				text: `[htmlPlugin]: expected output html file to be constituted of just a single input html file, `
					+ `but found it to be made out of "${number_of_sources}" source files.`
					+ `input sources: [${args.inputs.map((input_file) => (input_file.namespace + ":" + input_file.path)).join("\n")}]`
			})
			return { errors }
		}
		const { htmlDocument } = args.inputs[0].emitData as HtmlDependencyEmitData

		await promise_all(args.imports.map(async (imported_entity): Promise<void> => {
			const
				{ key: reinsertion_task, outputPath, external } = imported_entity as ImportedEntity<HtmlNodeReplacementContentTask>,
				{ originalArgs, replaceContent, handlerData } = reinsertion_task,
				// now we resolve the `outputPath` as relative path if it is not an external path.
				relative_path = external ? undefined : relativePath(htmlOutputPath, outputPath),
				replace_content_args: ReplaceContentFnArgs = {
					...originalArgs,
					...imported_entity,
					htmlOutputPath,
					relativePath: relative_path,
					handlerData,
				}

			// re-inserting the new link/reference back into the html node.
			const {
				warnings: local_warnings = [],
				errors: local_errors = [],
			} = await replaceContent(replace_content_args, replace_content_ctx) ?? {}
			warnings.push(...local_warnings)
			errors.push(...local_errors)
		}))

		const rendered_html = await htmlRender(htmlDocument)
		return { contents: rendered_html, warnings, errors }
	})
}
