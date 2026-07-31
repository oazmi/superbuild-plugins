/** the import-meta plugin lets you include up files referenced by your `import.meta.resolve("...")` statements inside your js-like source files.
 *
 * @module
*/
import { contentsToString, escapeLiteralStringForRegex, isNull, relativePath } from "../../deps.js";
const default_pattern = /import\s*\.\s*meta\s*\.\s*resolve\s*\(\s*(?<quote>["'`]).*?\k<quote>\s*\)/g, default_import_path_extractor = /import\s*\.\s*meta\s*\.\s*resolve\s*\(\s*(?<quote>["'`])(?<importPath>.*?)\k<quote>\s*\)/, default_extractImportPath = (import_statement) => {
    return default_import_path_extractor.exec(import_statement).groups.importPath;
}, default_insertImportPath = (output_path) => {
    return `import.meta.resolve("${output_path}")`;
};
/** the default configuration for {@link importmetaPluginSetup}. */
export const defaultImportmetaPluginSetupConfig = {
    pattern: default_pattern,
    extractImportPath: default_extractImportPath,
    insertImportPath: default_insertImportPath,
    transformFilters: [
        { filter: /.*/, loader: "js", namespace: undefined },
        { filter: /.*/, loader: "jsx", namespace: undefined },
        { filter: /.*/, loader: "ts", namespace: undefined },
        { filter: /.*/, loader: "tsx", namespace: undefined },
    ]
};
/** the import-meta plugin lets you bundle up files referenced via `import.meta.resolve("...")` in your `js`, `jsx`, `ts`, and `tsx` source files. */
export const importmetaPluginSetup = (config) => {
    return (build) => importmetaPluginSetupBase(build, config);
};
const importmetaPluginSetupBase = (build, config) => {
    const { pattern, extractImportPath, insertImportPath, transformFilters } = { ...defaultImportmetaPluginSetupConfig, ...config }, emitFilters = transformFilters.map((transformFilter) => {
        return { filter: /.*/, inputs: [transformFilter] };
    }), replacement_text = "_IMPORT_META_RESOLVE_", replacement_statement_regex = new RegExp(`${escapeLiteralStringForRegex(replacement_text)}\\d+`, "g"), import_key_regex = new RegExp(`\^${replacement_statement_regex.source}\$`), pattern_non_global = new RegExp(pattern.source);
    const ALREADY_CAPTURED_ON_TRANSFORM = Symbol(), ALREADY_CAPTURED_ON_EMIT = Symbol();
    const on_transform_callback = async (args) => {
        const { contents: _contents, pluginData = {}, ...rest_args } = args;
        // do not re-capture any entity that has already been processed once.
        if (pluginData[ALREADY_CAPTURED_ON_TRANSFORM]) {
            return;
        }
        // if an entity does not contain any content that matches the user proved `pattern`, then we skip that too.
        const contents = contentsToString(_contents), content_contains_pattern = pattern_non_global.test(contents);
        if (!content_contains_pattern) {
            return;
        }
        pluginData[ALREADY_CAPTURED_ON_TRANSFORM] = true;
        let key_counter = 0;
        const warnings = [], imports = [], 
        // now we replace all `import.meta.resolve("...")` statements with `${replacement_text}${key_counter++}`.
        updated_contents = contents.replaceAll(pattern, (...match_args) => {
            const match_str = match_args[0], import_path = extractImportPath(match_str);
            if (isNull(import_path)) {
                return match_str;
            }
            const key = `${replacement_text}${key_counter++}`;
            imports.push({ key, path: import_path });
            return key;
        });
        // checking if something else wants to transform this resource.
        const retransform_result = await build.transform({
            ...rest_args,
            pluginData,
            contents: updated_contents,
        });
        // finally, we join/merge back the results, wherever applicable.
        const { contents: re_contents = updated_contents, imports: re_imports = [], pluginData: re_pluginData = pluginData, warnings: re_warnings = [], ...rest_result } = retransform_result ?? {}, final_transform_result = {
            ...rest_result,
            contents: re_contents,
            imports: [...imports, ...re_imports],
            pluginData: re_pluginData,
            warnings: [...warnings, ...re_warnings],
        };
        re_pluginData[ALREADY_CAPTURED_ON_TRANSFORM] = false;
        return final_transform_result;
    };
    const on_emit_callback = async (args) => {
        const { contents: _contents, reEmitData = {}, ...rest_args } = args;
        // do not re-capture any entity that has already been processed once.
        if (reEmitData[ALREADY_CAPTURED_ON_EMIT]) {
            return;
        }
        // if no imports contain a key that matches this plugin's import-key template, then skip that resource.
        if (!args.imports.some(({ key }) => { return import_key_regex.test(key); })) {
            return;
        }
        reEmitData[ALREADY_CAPTURED_ON_EMIT] = true;
        const file_output_path = args.outputPath, warnings = [], imports = args.imports, contents = contentsToString(_contents), 
        // now we revert all `import.meta.resolve(import("..."))` statements back to `import.meta.resolve("...")` (or a user customizable equivalent).
        updated_contents = contents.replaceAll(replacement_statement_regex, (...match_args) => {
            const match_str = match_args[0];
            // 	groups = match_args.at(-1)
            // if (!isRecord(groups) || isNull(groups.importPath)) {
            // 	warnings.push({ text: `[importmetaPlugin:onEmit]: expected the regex group "importPath" to exist in the provided regex.` })
            // 	return match_str
            // }
            const imported_entity = imports.find(({ key }) => { return key === match_str; });
            if (isNull(imported_entity)) {
                return match_str;
            }
            const output_path = imported_entity.external
                ? imported_entity.outputPath
                // TODO: ISSUE: resolving as a relative path becomes problematic for the html-plugin's inline js handler,
                // because the `build.rerouteImports` method cannot reroute `import.meta.resolve(...)` and other arbitrary non-import statements.
                : relativePath(file_output_path, imported_entity.outputPath), replaced_import_statement = insertImportPath(output_path);
            return replaced_import_statement;
        });
        return {
            contents: updated_contents,
            warnings,
            reEmit: true,
            reEmitData,
        };
    };
    for (const transformFilter of transformFilters) {
        build.onTransform(transformFilter, on_transform_callback);
    }
    for (const emitFilter of emitFilters) {
        build.onEmit(emitFilter, on_emit_callback);
    }
};
