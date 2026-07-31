/** the import-meta plugin lets you include up files referenced by your `import.meta.resolve("...")` statements inside your js-like source files.
 *
 * @module
*/
import type { OnTransformOptions, Require, SuperPluginSetup } from "../../deps.js";
/** setup configuration options for the {@link importmetaPluginSetup}.
 *
 * @defaultValue {@link defaultImportmetaPluginSetupConfig}.
*/
export interface ImportmetaPluginSetupConfig {
    /** specify the regex pattern used for searching for `import.meta.resolve("...")` statements in you javascript/typescript source files.
     * the regex matches found here will be passed on to your {@link extractImportPath} function.
     *
     * @defaultValue `/import\s*\.\s*meta\s*\.\s*resolve\s*\(\s*(?<quote>["'`])(?<importPath>.*?)\k<quote>\s*\)/g`
    */
    pattern?: RegExp;
    /** the function you provide here complements your regex {@link pattern}, by extracting the path from it.
     * you may also use this opportunity for _interpreting_ the path associated with your resource that is to be imported.
     * if your function returns `undefined`, it will hint the import-meta plugin to skip that particular match from being bundled.
     *
     * @defaultValue a function that extracts the import path inside the `import.meta.resolve("...")` statement selected by the default {@link pattern}.
    */
    extractImportPath?: (import_statement: string) => string | undefined;
    /** the function you provide here is used for generating a string to re-insert back into your emitted js-file's
     * `import.meta.resolve` statement (which was originally selected from the {@link pattern}).
     * your function should accept the output path of the linked bundled resource,
     * and then enclose it with necessary stuff to turn it into a proper statement/expression.
     *
     * @defaultValue ```(output_path: string) => { return `import.meta.resolve("${output_path}")` }```
     * (i.e. the function puts back an `import.meta.resolve` statement with the bundled output path.
     * however, you are free to do other things, such as placing a string literal of the output path)
    */
    insertImportPath?: (output_path: string) => string;
    /** specify which loaded files/resoruces will need to be intercepted by the import-meta plugin.
     *
     * @defaultValue `{ filter: new RegExp(".*"), loader: "js" | "jsx" | "ts" | "tsx", namespace: undefined }`
    */
    transformFilters?: Array<Require<OnTransformOptions, "loader">>;
}
/** the default configuration for {@link importmetaPluginSetup}. */
export declare const defaultImportmetaPluginSetupConfig: Required<ImportmetaPluginSetupConfig>;
/** the import-meta plugin lets you bundle up files referenced via `import.meta.resolve("...")` in your `js`, `jsx`, `ts`, and `tsx` source files. */
export declare const importmetaPluginSetup: (config?: ImportmetaPluginSetupConfig) => SuperPluginSetup;
//# sourceMappingURL=setup.d.ts.map