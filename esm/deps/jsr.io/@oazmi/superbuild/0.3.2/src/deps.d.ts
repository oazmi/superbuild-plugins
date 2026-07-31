import type { MaybePromise } from "../../../kitchensink/0.10.1/src/typedefs.js";
export type * as esbuild from "../../../esbuild-types/0.28.0/src/mod.js";
export { array_isEmpty, console_log, date_now, dom_clearTimeout, dom_setTimeout, json_stringify, math_max, number_parseInt, object_assign, object_entries, object_fromEntries, object_keys, promise_all, promise_outside } from "../../../kitchensink/0.10.1/src/alias.js";
export { bind_array_push } from "../../../kitchensink/0.10.1/src/binder.js";
export { ensureFile, getRuntimeCwd, identifyCurrentRuntime, statEntry, writeFile } from "../../../kitchensink/0.10.1/src/crossenv.js";
export { crc32 } from "../../../kitchensink/0.10.1/src/cryptoman.js";
export { ensureEndSlash, ensureFileUrlIsLocalPath, ensureStartDotSlash, fileUrlToLocalPath, getUriScheme, isAbsolutePath, joinPaths, parseFilepathInfo, pathToPosixPath, relativePath, resolveAsUrl, resolvePathFactory } from "../../../kitchensink/0.10.1/src/pathman.js";
export { promiseOutside, promiseTimeout } from "../../../kitchensink/0.10.1/src/promiseman.js";
export { escapeLiteralStringForRegex } from "../../../kitchensink/0.10.1/src/stringman.js";
export { isArray, isFunction, isNull, isRecord, isString } from "../../../kitchensink/0.10.1/src/struct.js";
export type { AutoSuggestOrString, MaybePromise, MaybePromiseLike, Optional, Require } from "../../../kitchensink/0.10.1/src/typedefs.js";
/** flags used for minifying (or eliminating) debugging logs and asserts, when an intelligent bundler, such as `esbuild`, is used. */
export declare const enum DEBUG {
    LOG = 1,
    ASSERT = 1,
    ERROR = 1,
    PRODUCTION = 1,
    MINIFY = 0
}
export declare const noop: () => undefined;
export declare const urlToString: (url: string | URL) => string;
export declare const isRelativePath: (path: string) => boolean;
export declare const ensureRelativeDotSlash: (path: string) => string;
export declare const textEncoder: TextEncoder, textDecoder: TextDecoder;
/** represents either a regular value `T`, or nullable value (`null | undefined`), or a `Promise` thereof. */
export type MaybePromiseOrNull<T> = MaybePromise<T | null | undefined>;
/** represents either a regular value `T`, or void value (`null | undefined | void`), or a `Promise` thereof. */
export type MaybePromiseOrVoid<T> = MaybePromise<T | null | undefined | void>;
export type StrictOmit<T, K extends keyof T> = Omit<T, K>;
//# sourceMappingURL=deps.d.ts.map