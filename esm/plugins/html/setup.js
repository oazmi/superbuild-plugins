/** the html plugin lets you bundle up html files, along side bundling any standard resource links that it might reference.
 *
 * @module
*/
import { contentsToString, isNull, isRecord, promise_all, relativePath } from "../../deps.js";
import { ContentStore } from "./content_store.js";
import { htmlParse, htmlRender, htmlWalk } from "./deps.js";
import { allMediaLinkHandlers, pageLinkHandler, scriptInlineHandler, scriptLinkHandler, styleInlineHandler, styleLinkHandler } from "./node_handlers/mod.js";
/** the default configuration for {@link htmlPluginSetup}. */
export const defaultHtmlPluginSetupConfig = {
    transformFilter: { filter: /.*/, loader: "html", namespace: undefined },
    nodeHandlers: [
        ...allMediaLinkHandlers,
        pageLinkHandler,
        scriptLinkHandler,
        scriptInlineHandler,
        styleLinkHandler,
        styleInlineHandler,
    ],
};
/** the html plugin lets you bundle up html files, along side bundling any standard resource links that it might reference. */
export const htmlPluginSetup = (config) => {
    return (build) => htmlPluginSetupBase(build, config);
};
const htmlPluginSetupBase = (build, config) => {
    const { transformFilter, nodeHandlers } = { ...defaultHtmlPluginSetupConfig, ...config }, emitFilter = { filter: /.*/, inputs: [transformFilter] }, contentStore = new ContentStore(build), callback_ctx = { build, contentStore };
    build.onTransform(transformFilter, async (args) => {
        const { path: importer, namespace, resolveDir, pluginData } = args, contents = contentsToString(args.contents), html_doc = htmlParse(contents), html_imports = [], warnings = [], errors = [];
        const emit_data = { htmlDocument: html_doc };
        await htmlWalk(html_doc, async (node) => {
            for (const { filter, callback } of nodeHandlers) {
                if (filter.nodeType !== node.type) {
                    continue;
                }
                if ((filter.nodeName ?? false) && (filter.nodeName !== node.name)) {
                    continue;
                }
                if ((filter.nodeAttribute ?? false) && isRecord(node.attributes) && !(filter.nodeAttribute in node.attributes)) {
                    continue;
                }
                const args = {
                    htmlDocument: html_doc,
                    htmlNode: node,
                    htmlPath: importer,
                    htmlNamespace: namespace,
                };
                const result = await callback(args, callback_ctx);
                if (isNull(result?.path)) {
                    continue;
                }
                const { path, replaceContent, handlerData, ...resolution_args } = result, reinsertion_task = { originalArgs: args, replaceContent, handlerData };
                // asserting that `resolution_args` strictly contains valid esbuild resolve args.
                const resolution_args_are_valid = true;
                html_imports.push({ key: reinsertion_task, path, ...resolution_args });
                break;
            }
        });
        return {
            contents: "",
            loader: "copy",
            imports: html_imports,
            emitData: emit_data,
            warnings,
            errors,
        };
    });
    build.onEmit(emitFilter, async (args, output_file_registry) => {
        const replace_content_ctx = { ...callback_ctx, outputs: output_file_registry }, warnings = [], errors = [], number_of_sources = args.inputs.length, htmlOutputPath = args.outputPath;
        if (number_of_sources !== 1) {
            errors.push({
                location: { file: htmlOutputPath },
                text: `[htmlPlugin]: expected output html file to be constituted of just a single input html file, `
                    + `but found it to be made out of "${number_of_sources}" source files.`
                    + `input sources: [${args.inputs.map((input_file) => (input_file.namespace + ":" + input_file.path)).join("\n")}]`
            });
            return { errors };
        }
        const { htmlDocument } = args.inputs[0].emitData;
        await promise_all(args.imports.map(async (imported_entity) => {
            const { key: reinsertion_task, outputPath, external } = imported_entity, { originalArgs, replaceContent, handlerData } = reinsertion_task, 
            // now we resolve the `outputPath` as relative path if it is not an external path.
            relative_path = external ? undefined : relativePath(htmlOutputPath, outputPath), replace_content_args = {
                ...originalArgs,
                ...imported_entity,
                htmlOutputPath,
                relativePath: relative_path,
                handlerData,
            };
            // re-inserting the new link/reference back into the html node.
            const { warnings: local_warnings = [], errors: local_errors = [], } = await replaceContent(replace_content_args, replace_content_ctx) ?? {};
            warnings.push(...local_warnings);
            errors.push(...local_errors);
        }));
        const rendered_html = await htmlRender(htmlDocument);
        return { contents: rendered_html, warnings, errors };
    });
};
