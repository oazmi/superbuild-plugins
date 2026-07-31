# @oazmi/superbuild-plugins/importmeta

a superbuild plugin for bundling references made via `import.meta.resolve(...)`.

the way how it works is by replacing any `import.meta.resolve("./path/to/resource")` contained within any js-like file,
with `_IMPORT_META_RESOLVE_${number}` during the transformation stage,
declaring the `"./path/to/resource"` as a transformation-stage dependency `OnTransformResult.imports`;
followed by scanning for the `_IMPORT_META_RESOLVE_${number}` pattern during the emission stage,
and then revering it back to a `import.meta.resolve("./output/path/to/bundled/resource")` statement.
