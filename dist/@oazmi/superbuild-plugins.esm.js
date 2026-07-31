// src/plugins/css/setup.ts
var defaultCssPluginSetupConfig = {
  // TODO: also include "local-css" loader separately.
  transformFilter: { filter: /.*/, loader: "css", namespace: void 0 }
};
var cssPluginSetup = (config) => {
  return (build) => cssPluginSetupBase(build, config);
};
var cssPluginSetupBase = (build, config) => {
  const { transformFilter } = { ...defaultCssPluginSetupConfig, ...config }, emitFilter = { filter: /.*/, inputs: [transformFilter] };
  build.onTransform(transformFilter, async (args) => {
    const { loader, ...rest_args } = args, { contents, imports, warnings, errors } = await extractCssDeps(build, { ...rest_args, loader });
    return { loader: "copy", contents, imports, warnings, errors };
  });
  const ALREADY_CAPTURED = Symbol();
  build.onEmit(emitFilter, async (args) => {
    if (args.reEmitData?.[ALREADY_CAPTURED]) {
      return;
    }
    const imported_entities = args.imports.map((imported_entity) => {
      const { key: _key, initialPath, outputPath, external: _external, ...rest_props } = imported_entity, key = _key, external = true, select_initialPath = `${css_dependency_path_prefix}${key}`, replace_outputPath = initialPath ?? outputPath;
      return { key, initialPath: select_initialPath, outputPath: replace_outputPath, external, ...rest_props };
    });
    const new_args = { ...args, imports: imported_entities }, result = await build.rerouteImports(new_args, "css"), reEmitData = args.reEmitData ?? {};
    reEmitData[ALREADY_CAPTURED] = true;
    return { ...result, reEmit: true, reEmitData };
  });
};
var css_dependency_path_prefix = `CSS_IMPORT:`;
var extractCssDepsPluginSetupFactory = (all_imports, build) => {
  let key_counter = 0;
  build.onResolve({ filter: /.*/ }, (args) => {
    const { kind, path } = args;
    if (kind === "entry-point") {
      return;
    }
    const key = key_counter++, new_path = `${css_dependency_path_prefix}${key}`;
    all_imports.push({ key, kind, path });
    return { path: new_path, namespace: "discard-this", external: true };
  });
};
var extractCssDeps = async (build, args) => {
  const sbuild = build, { absWorkingDir, nodePaths, alias } = build.initialOptions, { path, contents, loader, resolveDir } = args, all_imports = [], extractCssDepsPlugin = {
    name: "does-not-matter",
    setup: extractCssDepsPluginSetupFactory.bind(void 0, all_imports)
  };
  const base_esbuild = (sbuild.getInnerEsbuildPluginBuild?.() ?? build).esbuild;
  const build_result = await base_esbuild.build({
    stdin: { contents, loader, resolveDir, sourcefile: path },
    plugins: [extractCssDepsPlugin],
    absWorkingDir,
    nodePaths,
    alias,
    format: "esm",
    write: false,
    bundle: true,
    minify: true,
    treeShaking: false
  });
  const warnings = [...build_result.warnings], errors = [...build_result.errors], output_files = build_result.outputFiles, output_css_contents = output_files.at(0)?.contents ?? new Uint8Array();
  if (output_files.length !== 1) {
    errors.push({
      text: `[cssPlugin:extractCssDeps]: expected only a single file to be emitted, found "${output_files.length}".`,
      location: { file: path }
    });
  }
  return {
    contents: output_css_contents,
    imports: all_imports,
    warnings,
    errors
  };
};

// src/plugins/css/mod.ts
var cssPlugin = (config) => {
  return {
    name: "oazmi-superbuild-plugin-css",
    setup: cssPluginSetup(config)
  };
};

// src/deps/jsr.io/@oazmi/kitchensink/0.10.1/src/alias.ts
var array_constructor = Array;
var math_constructor = Math;
var number_constructor = Number;
var promise_constructor = Promise;
var array_from = /* @__PURE__ */ (() => array_constructor.from)();
var array_isArray = /* @__PURE__ */ (() => array_constructor.isArray)();
var math_min = /* @__PURE__ */ (() => math_constructor.min)();
var number_isNaN = /* @__PURE__ */ (() => number_constructor.isNaN)();
var promise_all = /* @__PURE__ */ promise_constructor.all.bind(promise_constructor);

// src/deps/jsr.io/@oazmi/kitchensink/0.10.1/src/struct.ts
var isNull = (obj) => {
  return obj === void 0 || obj === null;
};
var isObject = (obj) => {
  return typeof obj === "object";
};
var isArray = array_isArray;
var isRecord = (obj) => {
  return isObject(obj) && obj !== null && !isArray(obj);
};
var isString = (obj) => {
  return typeof obj === "string";
};

// src/deps/jsr.io/@oazmi/kitchensink/0.10.1/src/stringman.ts
var commonPrefix = (inputs) => {
  const len = inputs.length;
  if (len < 1) return "";
  const inputs_lengths = inputs.map((str) => str.length), shortest_input_length = math_min(...inputs_lengths), shortest_input = inputs[inputs_lengths.indexOf(shortest_input_length)];
  let left = 0, right = shortest_input_length;
  while (left <= right) {
    const center = (left + right) / 2 | 0, prefix = shortest_input.substring(0, center);
    if (inputs.every((input) => input.startsWith(prefix))) {
      left = center + 1;
    } else {
      right = center - 1;
    }
  }
  return shortest_input.substring(0, (left + right) / 2 | 0);
};
var escapeLiteralCharsRegex = /[.*+?^${}()|[\]\\]/g;
var escapeLiteralStringForRegex = (str) => str.replaceAll(escapeLiteralCharsRegex, "\\$&");

// src/deps/jsr.io/@oazmi/kitchensink/0.10.1/src/pathman.ts
var sep = "/";
var dotslash = "./";
var dotdotslash = "../";
var windows_directory_slash_regex = /\\/g;
var leading_slashes_regex = /^\/+/;
var filename_regex = /\/?[^\/]+$/;
var basename_and_extname_regex = /^(?<basename>.+?)(?<ext>\.[^\.]+)?$/;
var string_starts_with = (str, starts_with) => str.startsWith(starts_with);
var string_ends_with = (str, ends_with) => str.endsWith(ends_with);
var trimStartSlashes = (str) => {
  return str.replace(leading_slashes_regex, "");
};
var ensureEndSlash = (str) => {
  return string_ends_with(str, sep) ? str : str + sep;
};
var normalizePosixPath = (path, config = {}) => {
  const { keepRelative = true } = isObject(config) ? config : {}, segments = path.split(sep), last_segment = segments.at(-1), output_segments = [".."], prepend_relative_dotslash_to_output_segments = keepRelative && segments[0] === ".", ends_with_dir_navigator_without_a_trailing_slash = segments.length >= 2 && (last_segment === "." || last_segment === "..");
  if (ends_with_dir_navigator_without_a_trailing_slash) {
    segments.push("");
  }
  for (const segment of segments) {
    if (segment === "..") {
      if (output_segments.at(-1) !== "..") {
        output_segments.pop();
      } else {
        output_segments.push(segment);
      }
    } else if (segment !== ".") {
      output_segments.push(segment);
    }
  }
  output_segments.shift();
  if (prepend_relative_dotslash_to_output_segments && output_segments[0] !== "..") {
    output_segments.unshift(".");
  }
  return output_segments.join(sep);
};
var normalizePath = (path, config) => {
  return normalizePosixPath(pathToPosixPath(path), config);
};
var pathToPosixPath = (path) => path.replaceAll(windows_directory_slash_regex, sep);
var commonNormalizedPosixPath = (paths) => {
  const common_prefix = commonPrefix(paths), common_prefix_length = common_prefix.length;
  for (const path of paths) {
    const remaining_substring = path.slice(common_prefix_length);
    if (!string_starts_with(remaining_substring, sep)) {
      const common_dir_prefix_length = common_prefix.lastIndexOf(sep) + 1, common_dir_prefix = common_prefix.slice(0, common_dir_prefix_length);
      return common_dir_prefix;
    }
  }
  return common_prefix;
};
var commonPathTransform = (paths, map_fn) => {
  const normal_paths = paths.map(normalizePath), common_dir = commonNormalizedPosixPath(normal_paths), common_dir_length = common_dir.length, path_infos = array_from(normal_paths, (normal_path) => {
    return [common_dir, normal_path.slice(common_dir_length)];
  });
  return path_infos.map(map_fn);
};
var parseNormalizedPosixFilename = (file_path) => {
  return trimStartSlashes(filename_regex.exec(file_path)?.[0] ?? "");
};
var parseBasenameAndExtname_FromFilename = (filename) => {
  const { basename = "", ext = "" } = basename_and_extname_regex.exec(filename)?.groups ?? {};
  return [basename, ext];
};
var parseFilepathInfo = (file_path) => {
  const path = normalizePath(file_path), filename = parseNormalizedPosixFilename(path), filename_length = filename.length, dirpath = filename_length > 0 ? path.slice(0, -filename_length) : path, dirname = parseNormalizedPosixFilename(dirpath.slice(0, -1)), [basename, extname] = parseBasenameAndExtname_FromFilename(filename);
  return { path, dirpath, dirname, filename, basename, extname };
};
var relativePath = (from_path, to_path) => {
  const [
    [common_dir, from_subpath],
    [, to_subpath]
  ] = commonPathTransform([from_path, to_path], (common_dir_and_subpath) => common_dir_and_subpath);
  if (common_dir === "") {
    throw new Error(1 /* ERROR */ ? `there is no common directory between the two provided paths:
	"${from_path}" and
	"to_path"` : "");
  }
  const upwards_traversal = Array(from_subpath.split(sep).length).fill("..");
  upwards_traversal[0] = ".";
  return normalizePosixPath(upwards_traversal.join(sep) + sep + to_subpath);
};
var joinPosixPaths_reduce_fn = (concatenatible_full_path, segment) => {
  const prev_segment = concatenatible_full_path.pop(), prev_segment_is_dir = string_ends_with(prev_segment, sep), prev_segment_as_dir = prev_segment_is_dir ? prev_segment : prev_segment + sep;
  if (!prev_segment_is_dir) {
    const segment_is_rel_to_dir = string_starts_with(segment, dotslash), segment_is_rel_to_parent_dir = string_starts_with(segment, dotdotslash);
    if (segment_is_rel_to_dir) {
      segment = "." + segment;
    } else if (segment_is_rel_to_parent_dir) {
      segment = dotdotslash + segment;
    }
  }
  concatenatible_full_path.push(prev_segment_as_dir, segment);
  return concatenatible_full_path;
};
var joinPosixPaths = (...segments) => {
  segments = segments.map((segment) => {
    return segment === "." ? dotslash : segment === ".." ? dotdotslash : segment;
  });
  const concatenatible_segments = segments.reduce(joinPosixPaths_reduce_fn, [sep]);
  concatenatible_segments.shift();
  return normalizePosixPath(concatenatible_segments.join(""));
};

// src/deps.ts
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
var contentsToUint8Array = (contents) => {
  return isString(contents) ? textEncoder.encode(contents) : contents;
};
var contentsToString = (contents) => {
  return isString(contents) ? contents : textDecoder.decode(contents);
};

// src/plugins/html/content_store.ts
var content_store_name = "oazmi-superbuild-plugin-html-content_store";
var ContentStore = class {
  /** the prefix that must be attached to stored resources' initial path (i.e. the path passed to `build.resolve(...)`). */
  prefix = `${content_store_name}:`;
  /** the namespace that will be attached to resolved virtual contents' "path". */
  namespace = `${content_store_name}-ns`;
  /** contains all of the files inserted via the {@link add} method. */
  files = /* @__PURE__ */ new Map();
  /** contains all of the emitted files that originated from the virtual resource {@link files}. */
  outputFiles = /* @__PURE__ */ new Map();
  /** a unique resource id that is incremented for each new resource. */
  resourceId = 0;
  constructor(build) {
    const prefix = this.prefix, namespace = this.namespace, filter = new RegExp(escapeLiteralStringForRegex("/" + prefix) + "\\d+$");
    const self = this;
    build.onResolve({ filter }, (args) => {
      self.getInput(args.path).importerNamespace = args.namespace;
      return {
        path: args.path,
        namespace,
        // we propagate the plugin data in case it contains crucial contextual information for other plugins to make use of.
        pluginData: args.pluginData
      };
    });
    build.onLoad({ filter: /.*/, namespace }, (args) => {
      const { importerPath, contents, loader } = self.getInput(args.path), resolveDir = ensureEndSlash(parseFilepathInfo(importerPath).dirpath);
      return { contents, loader, resolveDir, pluginData: args.pluginData };
    });
    build.onResolve({ filter: /.*/, namespace }, (args) => {
      const { path, importer, namespace: _namespace, ...rest_args } = args, { importerPath: original_importer, importerNamespace: original_importer_namespace } = self.getInput(importer);
      return build.resolve(path, { ...rest_args, importer: original_importer, namespace: original_importer_namespace });
    });
    const ALREADY_ENCOUNTERED = Symbol();
    build.onEmit({
      filter: /.*/,
      inputs: [{ filter: /.*/, namespace }]
    }, (args, output_file_registry) => {
      if (args.reEmitData?.[ALREADY_ENCOUNTERED] === true) {
        return;
      }
      const errors = [], { outputPath, contents, inputs } = args, sources_from_namespace = inputs.filter((input) => {
        return input.namespace === namespace;
      }), number_of_sources_from_namespace = sources_from_namespace.length;
      if (number_of_sources_from_namespace !== 1) {
        errors.push({
          location: { file: outputPath },
          text: `[ContentStore]: expected output virtual file to be constituted of just a single primary input file, but found it to be made out of "${number_of_sources_from_namespace}" primary source files.input sources: [${sources_from_namespace.map((input_file) => input_file.namespace + ":" + input_file.path).join("\n")}]`
        });
        return { errors };
      }
      const reEmitData = args.reEmitData ?? {}, { path: resolved_path, loader } = sources_from_namespace[0], id = self.decodeResolvedPath(resolved_path);
      self.outputFiles.set(id, { id, importerPath: resolved_path, loader, contents });
      reEmitData[ALREADY_ENCOUNTERED] = true;
      return { write: false, reEmit: true, reEmitData };
    });
  }
  /** encode a virtual resource file's id to an esbuild-resolvable path.
   *
   * the reason why encode the virtual file in a certain way is because we want its content's relative references to still stay intact.
   * the way by which we encode the resource path is: `${importer_dir}/${prefix}${id}`,
   * where `importer_dir` is the directory of `importer.importerPath`, and `prefix` is {@link prefix}.
  */
  encodeResolvedPath(id, importer) {
    const { importerPath } = importer, importer_dir = ensureEndSlash(parseFilepathInfo(importerPath).dirpath), resource_filename = `./${this.prefix}${id}`, resource_path = joinPosixPaths(importer_dir, resource_filename);
    return resource_path;
  }
  /** decode the output of {@link encodeResolvedPath} to get back the original unique file/resource {@link FileId} from it. */
  decodeResolvedPath(resolved_path) {
    const resource_filename = parseFilepathInfo(resolved_path).filename, id = Number(resource_filename.slice(this.prefix.length));
    if (number_isNaN(id)) {
      throw new Error(`[ContentStore.decodeResolvedPath]: could not decode the resource id number of the resolved path: "${resolved_path}".`);
    }
    return id;
  }
  /** acquire a unique new resource id. */
  newId() {
    return this.resourceId++;
  }
  /** add a new content to this content-storage.
   * the returned value will reflect the unique resource id assigned to your newly added content.
  */
  add(config) {
    const id = this.newId(), { contents: _contents, importerPath, importerNamespace, loader } = config, contents = contentsToUint8Array(_contents), resource_path = this.encodeResolvedPath(id, config);
    this.files.set(id, { id, importerPath, importerNamespace, loader, contents });
    return resource_path;
  }
  /** load a content from the content-storage, based on the unique resource file path it was assigned during the {@link add} method. */
  getInput(resolved_path) {
    const id = this.decodeResolvedPath(resolved_path), file = this.files.get(id);
    if (isNull(file)) {
      throw new Error(`[ContentStore.getInput]: couldn't find the resource with the following id: "${resolved_path}".`);
    }
    return file;
  }
  /** get the contents of the bundled/emitted output virtual resource. */
  getOutput(resolved_path) {
    const id = this.decodeResolvedPath(resolved_path), file = this.outputFiles.get(id);
    if (isNull(file)) {
      throw new Error(`[ContentStore.getOutput]: couldn't find the resource with the following id: "${resolved_path}".`);
    }
    return file;
  }
};

// node_modules/ultrahtml/dist/index.js
var DOCUMENT_NODE = 0;
var ELEMENT_NODE = 1;
var TEXT_NODE = 2;
var COMMENT_NODE = 3;
var DOCTYPE_NODE = 4;
var Fragment = Symbol("Fragment");
var VOID_TAGS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
var RAW_TAGS = /* @__PURE__ */ new Set(["script", "style"]);
var DOM_PARSER_RE = /(?:<(\/?)([a-zA-Z][a-zA-Z0-9\:-]*)(?:\s([^>]*?))?((?:\s*\/)?)>|(<\!\-\-)([\s\S]*?)(\-\->)|(<\!)([\s\S]*?)(>))/gm;
var CHAR_AT = 64;
var CHAR_DOT = 46;
var CHAR_HYPHEN = 45;
var CHAR_COLON = 58;
var CHAR_UNDERSCORE = 95;
var CHAR_EQUALS = 61;
var CHAR_DOUBLE_QUOTE = 34;
var CHAR_SINGLE_QUOTE = 39;
var CHAR_BACKSLASH = 92;
function isAttrKeyIdentifier(chr) {
  return chr >= 97 && chr <= 122 || // a-z
  chr >= 65 && chr <= 90 || // A-Z
  chr >= 48 && chr <= 57 || // 0-9
  chr === CHAR_AT || chr === CHAR_DOT || chr === CHAR_HYPHEN || chr === CHAR_COLON || chr === CHAR_UNDERSCORE;
}
function splitAttrs(str) {
  let obj = {};
  if (str) {
    let state = "none";
    let currentKey;
    let currentValue = "";
    let tokenStartIndex;
    for (let currentIndex = 0; currentIndex < str.length; currentIndex++) {
      const currentChar = str.charCodeAt(currentIndex);
      if (state === "none") {
        if (isAttrKeyIdentifier(currentChar)) {
          if (currentKey) {
            obj[currentKey] = currentValue;
            currentKey = void 0;
            currentValue = "";
          }
          tokenStartIndex = currentIndex;
          state = "key";
        } else if (currentChar === CHAR_EQUALS && currentKey) {
          state = "value";
        }
      } else if (state === "key") {
        if (!isAttrKeyIdentifier(currentChar)) {
          currentKey = str.substring(tokenStartIndex, currentIndex);
          if (currentChar === CHAR_EQUALS) {
            state = "value";
          } else {
            state = "none";
          }
        }
      } else if (currentChar === CHAR_DOUBLE_QUOTE || currentChar === CHAR_SINGLE_QUOTE) {
        const quote2 = currentChar === CHAR_DOUBLE_QUOTE ? '"' : "'";
        const valueStart = currentIndex + 1;
        let closeIndex = str.indexOf(quote2, valueStart);
        while (closeIndex > 0 && str.charCodeAt(closeIndex - 1) === CHAR_BACKSLASH) {
          closeIndex = str.indexOf(quote2, closeIndex + 1);
        }
        if (closeIndex === -1) {
          break;
        }
        currentValue = str.substring(valueStart, closeIndex);
        currentIndex = closeIndex;
        state = "none";
      }
    }
    if (state === "key" && tokenStartIndex != void 0 && tokenStartIndex < str.length) {
      currentKey = str.substring(tokenStartIndex, str.length);
    }
    if (currentKey) {
      obj[currentKey] = currentValue;
    }
  }
  return obj;
}
function parse(input) {
  let str = typeof input === "string" ? input : input.value;
  let doc, parent, token, text, i, bStart, bText, bEnd, tag;
  const tags = [];
  DOM_PARSER_RE.lastIndex = 0;
  parent = doc = {
    type: DOCUMENT_NODE,
    children: []
  };
  let lastIndex = 0;
  function commitTextNode() {
    text = str.substring(lastIndex, DOM_PARSER_RE.lastIndex - token[0].length);
    if (text) {
      parent.children.push({
        type: TEXT_NODE,
        value: text,
        parent
      });
    }
  }
  while (token = DOM_PARSER_RE.exec(str)) {
    bStart = token[5] || token[8];
    bText = token[6] || token[9];
    bEnd = token[7] || token[10];
    if (RAW_TAGS.has(parent.name) && token[2] !== parent.name) {
      i = DOM_PARSER_RE.lastIndex - token[0].length;
      if (parent.children.length > 0) {
        parent.children[0].value += token[0];
      }
      continue;
    } else if (bStart === "<!--") {
      i = DOM_PARSER_RE.lastIndex - token[0].length;
      if (RAW_TAGS.has(parent.name)) {
        continue;
      }
      tag = {
        type: COMMENT_NODE,
        value: bText,
        parent,
        loc: [
          {
            start: i,
            end: i + bStart.length
          },
          {
            start: DOM_PARSER_RE.lastIndex - bEnd.length,
            end: DOM_PARSER_RE.lastIndex
          }
        ]
      };
      tags.push(tag);
      tag.parent.children.push(tag);
    } else if (bStart === "<!") {
      i = DOM_PARSER_RE.lastIndex - token[0].length;
      tag = {
        type: DOCTYPE_NODE,
        value: bText,
        parent,
        loc: [
          {
            start: i,
            end: i + bStart.length
          },
          {
            start: DOM_PARSER_RE.lastIndex - bEnd.length,
            end: DOM_PARSER_RE.lastIndex
          }
        ]
      };
      tags.push(tag);
      tag.parent.children.push(tag);
    } else if (token[1] !== "/") {
      commitTextNode();
      if (RAW_TAGS.has(parent.name)) {
        lastIndex = DOM_PARSER_RE.lastIndex;
        commitTextNode();
        continue;
      } else {
        tag = {
          type: ELEMENT_NODE,
          name: token[2] + "",
          attributes: splitAttrs(token[3]),
          parent,
          children: [],
          loc: [
            {
              start: DOM_PARSER_RE.lastIndex - token[0].length,
              end: DOM_PARSER_RE.lastIndex
            }
          ]
        };
        tags.push(tag);
        tag.parent.children.push(tag);
        if (token[4] && token[4].indexOf("/") > -1 || VOID_TAGS.has(tag.name)) {
          tag.loc[1] = tag.loc[0];
          tag.isSelfClosingTag = true;
        } else {
          parent = tag;
        }
      }
    } else {
      commitTextNode();
      if (token[2] + "" === parent.name) {
        tag = parent;
        parent = tag.parent;
        tag.loc.push({
          start: DOM_PARSER_RE.lastIndex - token[0].length,
          end: DOM_PARSER_RE.lastIndex
        });
        text = str.substring(tag.loc[0].end, tag.loc[1].start);
        if (tag.children.length === 0) {
          tag.children.push({
            type: TEXT_NODE,
            value: text,
            parent
          });
        }
      } else if (token[2] + "" === tags[tags.length - 1].name && tags[tags.length - 1].isSelfClosingTag === true) {
        tag = tags[tags.length - 1];
        tag.loc.push({
          start: DOM_PARSER_RE.lastIndex - token[0].length,
          end: DOM_PARSER_RE.lastIndex
        });
      }
    }
    lastIndex = DOM_PARSER_RE.lastIndex;
  }
  text = str.slice(lastIndex);
  parent.children.push({
    type: TEXT_NODE,
    value: text,
    parent
  });
  return doc;
}
var Walker = class {
  constructor(callback) {
    this.callback = callback;
  }
  async visit(node, parent, index) {
    await this.callback(node, parent, index);
    if (Array.isArray(node.children)) {
      let promises = [];
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        promises.push(this.visit(child, node, i));
      }
      await Promise.all(promises);
    }
  }
};
var HTMLString = Symbol("HTMLString");
var AttrString = Symbol("AttrString");
var RenderFn = Symbol("RenderFn");
function mark(str, tags = [HTMLString]) {
  const v = { value: str };
  for (const tag of tags) {
    Object.defineProperty(v, tag, {
      value: true,
      enumerable: false,
      writable: false
    });
  }
  return v;
}
var ESCAPE_CHARS = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;"
};
function escapeHTML(str) {
  return str.replace(/[&<>]/g, (c) => ESCAPE_CHARS[c] || c);
}
function attrsToString(attributes) {
  let attrStr = "";
  for (const [key, value] of Object.entries(attributes)) {
    attrStr += ` ${key}="${value}"`;
  }
  return attrStr;
}
function walk(node, callback) {
  const walker = new Walker(callback);
  return walker.visit(node);
}
function canSelfClose(node) {
  if (node.children.length === 0) {
    let n = node;
    while (n = n.parent) {
      if (n.name === "svg") return true;
    }
  }
  return false;
}
async function renderElement(node) {
  const { name, attributes = {} } = node;
  const children = await Promise.all(
    node.children.map((child) => render(child))
  ).then((res) => res.join(""));
  if (RenderFn in node) {
    const value = await node[RenderFn](attributes, mark(children));
    if (value && value[HTMLString]) return value.value;
    return escapeHTML(String(value));
  }
  if (name === Fragment) return children;
  const isSelfClosing = canSelfClose(node);
  if (isSelfClosing || VOID_TAGS.has(name)) {
    return `<${node.name}${attrsToString(attributes)}${isSelfClosing ? " /" : ""}>`;
  }
  return `<${node.name}${attrsToString(attributes)}>${children}</${node.name}>`;
}
async function render(node) {
  switch (node.type) {
    case DOCUMENT_NODE:
      return Promise.all(
        node.children.map((child) => render(child))
      ).then((res) => res.join(""));
    case ELEMENT_NODE:
      return renderElement(node);
    case TEXT_NODE:
      return `${node.value}`;
    case COMMENT_NODE:
      return `<!--${node.value}-->`;
    case DOCTYPE_NODE:
      return `<!${node.value}>`;
  }
}

// src/plugins/html/deps.ts
var HTML_NODE_TYPE = /* @__PURE__ */ ((HTML_NODE_TYPE2) => {
  HTML_NODE_TYPE2[HTML_NODE_TYPE2["DOCUMENT"] = DOCUMENT_NODE] = "DOCUMENT";
  HTML_NODE_TYPE2[HTML_NODE_TYPE2["ELEMENT"] = ELEMENT_NODE] = "ELEMENT";
  HTML_NODE_TYPE2[HTML_NODE_TYPE2["TEXT"] = TEXT_NODE] = "TEXT";
  HTML_NODE_TYPE2[HTML_NODE_TYPE2["COMMENT"] = COMMENT_NODE] = "COMMENT";
  HTML_NODE_TYPE2[HTML_NODE_TYPE2["DOCTYPE"] = DOCTYPE_NODE] = "DOCTYPE";
  return HTML_NODE_TYPE2;
})(HTML_NODE_TYPE || {});

// src/plugins/html/node_handlers/media_link.ts
var srcAttributeHandlerCallback = (args, ctx) => {
  const src_path = args.htmlNode.attributes["src"];
  const is_external = "external" in args.htmlNode.attributes;
  return {
    path: src_path,
    external: is_external,
    replaceContent: replaceSrcContent
  };
};
var replaceSrcContent = (args, ctx) => {
  const node = args.htmlNode, output_path = args.relativePath ?? args.outputPath;
  node.attributes["src"] = output_path;
};
var replaceHrefContent = (args, ctx) => {
  const node = args.htmlNode, output_path = args.relativePath ?? args.outputPath;
  node.attributes["href"] = output_path;
};
var imgLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "img", nodeAttribute: "src" };
var imgLinkHandlerCallback = srcAttributeHandlerCallback;
var videoLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "video", nodeAttribute: "src" };
var videoLinkHandlerCallback = srcAttributeHandlerCallback;
var audioLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "audio", nodeAttribute: "src" };
var audioLinkHandlerCallback = srcAttributeHandlerCallback;
var embedLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "embed", nodeAttribute: "src" };
var embedLinkHandlerCallback = srcAttributeHandlerCallback;
var iframeLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "iframe", nodeAttribute: "src" };
var iframeLinkHandlerCallback = srcAttributeHandlerCallback;
var iconLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "link", nodeAttribute: "rel" };
var iconLinkHandlerCallback = (args, ctx) => {
  const html_node_attrs = args.htmlNode.attributes, rel_tokens = html_node_attrs["rel"].toLowerCase().split(" ");
  if (!rel_tokens.includes("icon")) {
    return;
  }
  if (!isString(html_node_attrs["href"])) {
    return;
  }
  const src_path = html_node_attrs["href"], is_external = "external" in args.htmlNode.attributes;
  return {
    path: src_path,
    external: is_external,
    replaceContent: replaceHrefContent
  };
};
var allMediaLinkHandlers = [
  { filter: imgLinkHandlerFilter, callback: imgLinkHandlerCallback },
  { filter: videoLinkHandlerFilter, callback: videoLinkHandlerCallback },
  { filter: audioLinkHandlerFilter, callback: audioLinkHandlerCallback },
  { filter: embedLinkHandlerFilter, callback: embedLinkHandlerCallback },
  { filter: iframeLinkHandlerFilter, callback: iframeLinkHandlerCallback },
  { filter: iconLinkHandlerFilter, callback: iconLinkHandlerCallback }
];
var media_link_default = allMediaLinkHandlers;

// src/plugins/html/node_handlers/page_link.ts
var pageLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "a", nodeAttribute: "href" };
var pageLinkHandlerCallback = (args, ctx) => {
  const href_path = args.htmlNode.attributes["href"];
  if (href_path.startsWith("#")) {
    return;
  }
  const is_external = "external" in args.htmlNode.attributes;
  return {
    path: href_path,
    external: is_external,
    replaceContent
  };
};
var replaceContent = (args, ctx) => {
  const node = args.htmlNode, output_path = args.relativePath ?? args.outputPath;
  node.attributes["href"] = output_path;
};
var page_link_default = {
  filter: pageLinkHandlerFilter,
  callback: pageLinkHandlerCallback
};

// src/plugins/html/node_handlers/script_inline.ts
var scriptInlineHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "script" };
var scriptInlineHandlerCallback = (args, ctx) => {
  if ("src" in (args.htmlNode.attributes ?? {})) {
    return;
  }
  const { contentStore } = ctx, { htmlNode, htmlPath, htmlNamespace } = args, child_nodes = htmlNode.children, script_text_content = child_nodes.find((child_node) => child_node.type === HTML_NODE_TYPE.TEXT);
  if (isNull(script_text_content)) {
    return;
  }
  const js_string = script_text_content.value;
  const virtual_src_path = contentStore.add({
    importerPath: htmlPath,
    importerNamespace: htmlNamespace,
    loader: "ts",
    contents: js_string
  });
  return {
    path: virtual_src_path,
    external: false,
    replaceContent: replaceContent2
  };
};
var replaceContent2 = async (args, ctx) => {
  const { build, outputs } = ctx, { htmlNode: node, outputPath, initialPath, htmlOutputPath } = args, file_entity = outputs.getFile(initialPath ?? outputPath);
  if (isNull(file_entity)) {
    const error_text = `[scriptInline:replaceContent]: expected to find the output entity: "${outputPath}", but couldn't locate it using the key: "${initialPath ?? outputPath}"`;
    return { errors: [{ text: error_text, location: { file: args.htmlPath, namespace: args.htmlNamespace } }] };
  }
  const child_nodes = node.children, script_text_content = child_nodes.find((child_node) => child_node.type === HTML_NODE_TYPE.TEXT);
  const { contents: migrated_contents, errors, warnings } = await build.rerouteImports(file_entity.toOnEmitArgs(), "js", htmlOutputPath);
  script_text_content.value = contentsToString(migrated_contents);
  return { warnings, errors };
};
var script_inline_default = {
  filter: scriptInlineHandlerFilter,
  callback: scriptInlineHandlerCallback
};

// src/plugins/html/node_handlers/script_link.ts
var scriptLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "script", nodeAttribute: "src" };
var scriptLinkHandlerCallback = (args, ctx) => {
  const src_path = args.htmlNode.attributes["src"];
  const is_external = "external" in args.htmlNode.attributes;
  return {
    path: src_path,
    external: is_external,
    replaceContent: replaceContent3
  };
};
var replaceContent3 = (args, ctx) => {
  const node = args.htmlNode, output_path = args.relativePath ?? args.outputPath;
  node.attributes["src"] = output_path;
};
var script_link_default = {
  filter: scriptLinkHandlerFilter,
  callback: scriptLinkHandlerCallback
};

// src/plugins/html/node_handlers/style_inline.ts
var styleInlineHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "style" };
var styleInlineHandlerCallback = (args, ctx) => {
  const { contentStore } = ctx, { htmlNode, htmlPath, htmlNamespace } = args, child_nodes = htmlNode.children, style_text_content = child_nodes.find((child_node) => child_node.type === HTML_NODE_TYPE.TEXT);
  if (isNull(style_text_content)) {
    return;
  }
  const css_string = style_text_content.value;
  const virtual_src_path = contentStore.add({
    importerPath: htmlPath,
    importerNamespace: htmlNamespace,
    loader: "css",
    contents: css_string
  });
  return {
    path: virtual_src_path,
    external: false,
    replaceContent: replaceContent4
  };
};
var replaceContent4 = async (args, ctx) => {
  const { build, outputs } = ctx, { htmlNode: node, outputPath, initialPath, htmlOutputPath } = args, file_entity = outputs.getFile(initialPath ?? outputPath);
  if (isNull(file_entity)) {
    const error_text = `[styleInline:replaceContent]: expected to find the output entity: "${outputPath}", but couldn't locate it using the key: "${initialPath ?? outputPath}"`;
    return { errors: [{ text: error_text, location: { file: args.htmlPath, namespace: args.htmlNamespace } }] };
  }
  const child_nodes = node.children, style_text_content = child_nodes.find((child_node) => child_node.type === HTML_NODE_TYPE.TEXT);
  const { contents: migrated_contents, errors, warnings } = await build.rerouteImports(file_entity.toOnEmitArgs(), "css", htmlOutputPath);
  style_text_content.value = contentsToString(migrated_contents);
  return { warnings, errors };
};
var style_inline_default = {
  filter: styleInlineHandlerFilter,
  callback: styleInlineHandlerCallback
};

// src/plugins/html/node_handlers/style_link.ts
var styleLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "link", nodeAttribute: "rel" };
var styleLinkHandlerCallback = (args, ctx) => {
  const html_node_attrs = args.htmlNode.attributes, rel_tokens = html_node_attrs["rel"].toLowerCase().split(" ");
  if (!rel_tokens.includes("stylesheet")) {
    return;
  }
  if (!isString(html_node_attrs["href"])) {
    return;
  }
  const src_path = html_node_attrs["href"], is_external = "external" in args.htmlNode.attributes;
  return {
    path: src_path,
    external: is_external,
    replaceContent: replaceContent5
  };
};
var replaceContent5 = (args, ctx) => {
  const node = args.htmlNode, output_path = args.relativePath ?? args.outputPath;
  node.attributes["href"] = output_path;
};
var style_link_default = {
  filter: styleLinkHandlerFilter,
  callback: styleLinkHandlerCallback
};

// src/plugins/html/setup.ts
var defaultHtmlPluginSetupConfig = {
  transformFilter: { filter: /.*/, loader: "html", namespace: void 0 },
  nodeHandlers: [
    ...media_link_default,
    page_link_default,
    script_link_default,
    script_inline_default,
    style_link_default,
    style_inline_default
  ]
};
var htmlPluginSetup = (config) => {
  return (build) => htmlPluginSetupBase(build, config);
};
var htmlPluginSetupBase = (build, config) => {
  const { transformFilter, nodeHandlers } = { ...defaultHtmlPluginSetupConfig, ...config }, emitFilter = { filter: /.*/, inputs: [transformFilter] }, contentStore = new ContentStore(build), callback_ctx = { build, contentStore };
  build.onTransform(transformFilter, async (args) => {
    const { path: importer, namespace, resolveDir, pluginData } = args, contents = contentsToString(args.contents), html_doc = parse(contents), html_imports = [], warnings = [], errors = [];
    const emit_data = { htmlDocument: html_doc };
    await walk(html_doc, async (node) => {
      for (const { filter, callback } of nodeHandlers) {
        if (filter.nodeType !== node.type) {
          continue;
        }
        if ((filter.nodeName ?? false) && filter.nodeName !== node.name) {
          continue;
        }
        if ((filter.nodeAttribute ?? false) && isRecord(node.attributes) && !(filter.nodeAttribute in node.attributes)) {
          continue;
        }
        const args2 = {
          htmlDocument: html_doc,
          htmlNode: node,
          htmlPath: importer,
          htmlNamespace: namespace
        };
        const result = await callback(args2, callback_ctx);
        if (isNull(result?.path)) {
          continue;
        }
        const { path, replaceContent: replaceContent6, handlerData, ...resolution_args } = result, reinsertion_task = { originalArgs: args2, replaceContent: replaceContent6, handlerData };
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
      errors
    };
  });
  build.onEmit(emitFilter, async (args, output_file_registry) => {
    const replace_content_ctx = { ...callback_ctx, outputs: output_file_registry }, warnings = [], errors = [], number_of_sources = args.inputs.length, htmlOutputPath = args.outputPath;
    if (number_of_sources !== 1) {
      errors.push({
        location: { file: htmlOutputPath },
        text: `[htmlPlugin]: expected output html file to be constituted of just a single input html file, but found it to be made out of "${number_of_sources}" source files.input sources: [${args.inputs.map((input_file) => input_file.namespace + ":" + input_file.path).join("\n")}]`
      });
      return { errors };
    }
    const { htmlDocument } = args.inputs[0].emitData;
    await promise_all(args.imports.map(async (imported_entity) => {
      const { key: reinsertion_task, outputPath, external } = imported_entity, { originalArgs, replaceContent: replaceContent6, handlerData } = reinsertion_task, relative_path = external ? void 0 : relativePath(htmlOutputPath, outputPath), replace_content_args = {
        ...originalArgs,
        ...imported_entity,
        htmlOutputPath,
        relativePath: relative_path,
        handlerData
      };
      const {
        warnings: local_warnings = [],
        errors: local_errors = []
      } = await replaceContent6(replace_content_args, replace_content_ctx) ?? {};
      warnings.push(...local_warnings);
      errors.push(...local_errors);
    }));
    const rendered_html = await render(htmlDocument);
    return { contents: rendered_html, warnings, errors };
  });
};

// src/plugins/html/mod.ts
var htmlPlugin = (config) => {
  return {
    name: "oazmi-superbuild-plugin-html",
    setup: htmlPluginSetup(config)
  };
};

// src/plugins/importmeta/setup.ts
var default_pattern = /import\s*\.\s*meta\s*\.\s*resolve\s*\(\s*(?<quote>["'`]).*?\k<quote>\s*\)/g;
var default_import_path_extractor = /import\s*\.\s*meta\s*\.\s*resolve\s*\(\s*(?<quote>["'`])(?<importPath>.*?)\k<quote>\s*\)/;
var default_extractImportPath = (import_statement) => {
  return default_import_path_extractor.exec(import_statement).groups.importPath;
};
var default_insertImportPath = (output_path) => {
  return `import.meta.resolve("${output_path}")`;
};
var defaultImportmetaPluginSetupConfig = {
  pattern: default_pattern,
  extractImportPath: default_extractImportPath,
  insertImportPath: default_insertImportPath,
  transformFilters: [
    { filter: /.*/, loader: "js", namespace: void 0 },
    { filter: /.*/, loader: "jsx", namespace: void 0 },
    { filter: /.*/, loader: "ts", namespace: void 0 },
    { filter: /.*/, loader: "tsx", namespace: void 0 }
  ]
};
var importmetaPluginSetup = (config) => {
  return (build) => importmetaPluginSetupBase(build, config);
};
var importmetaPluginSetupBase = (build, config) => {
  const { pattern, extractImportPath, insertImportPath, transformFilters } = { ...defaultImportmetaPluginSetupConfig, ...config }, emitFilters = transformFilters.map((transformFilter) => {
    return { filter: /.*/, inputs: [transformFilter] };
  }), replacement_text = "_IMPORT_META_RESOLVE_", replacement_statement_regex = new RegExp(`${escapeLiteralStringForRegex(replacement_text)}\\d+`, "g"), import_key_regex = new RegExp(`^${replacement_statement_regex.source}$`), pattern_non_global = new RegExp(pattern.source);
  const ALREADY_CAPTURED_ON_TRANSFORM = Symbol(), ALREADY_CAPTURED_ON_EMIT = Symbol();
  const on_transform_callback = async (args) => {
    const { contents: _contents, pluginData = {}, ...rest_args } = args;
    if (pluginData[ALREADY_CAPTURED_ON_TRANSFORM]) {
      return;
    }
    const contents = contentsToString(_contents), content_contains_pattern = pattern_non_global.test(contents);
    if (!content_contains_pattern) {
      return;
    }
    pluginData[ALREADY_CAPTURED_ON_TRANSFORM] = true;
    let key_counter = 0;
    const warnings = [], imports = [], updated_contents = contents.replaceAll(pattern, (...match_args) => {
      const match_str = match_args[0], import_path = extractImportPath(match_str);
      if (isNull(import_path)) {
        return match_str;
      }
      const key = `${replacement_text}${key_counter++}`;
      imports.push({ key, path: import_path });
      return key;
    });
    const retransform_result = await build.transform({
      ...rest_args,
      pluginData,
      contents: updated_contents
    });
    const {
      contents: re_contents = updated_contents,
      imports: re_imports = [],
      pluginData: re_pluginData = pluginData,
      warnings: re_warnings = [],
      ...rest_result
    } = retransform_result ?? {}, final_transform_result = {
      ...rest_result,
      contents: re_contents,
      imports: [...imports, ...re_imports],
      pluginData: re_pluginData,
      warnings: [...warnings, ...re_warnings]
    };
    re_pluginData[ALREADY_CAPTURED_ON_TRANSFORM] = false;
    return final_transform_result;
  };
  const on_emit_callback = async (args) => {
    const { contents: _contents, reEmitData = {}, ...rest_args } = args;
    if (reEmitData[ALREADY_CAPTURED_ON_EMIT]) {
      return;
    }
    if (!args.imports.some(({ key }) => {
      return import_key_regex.test(key);
    })) {
      return;
    }
    reEmitData[ALREADY_CAPTURED_ON_EMIT] = true;
    const file_output_path = args.outputPath, warnings = [], imports = args.imports, contents = contentsToString(_contents), updated_contents = contents.replaceAll(replacement_statement_regex, (...match_args) => {
      const match_str = match_args[0];
      const imported_entity = imports.find(({ key }) => {
        return key === match_str;
      });
      if (isNull(imported_entity)) {
        return match_str;
      }
      const output_path = imported_entity.external ? imported_entity.outputPath : relativePath(file_output_path, imported_entity.outputPath), replaced_import_statement = insertImportPath(output_path);
      return replaced_import_statement;
    });
    return {
      contents: updated_contents,
      warnings,
      reEmit: true,
      reEmitData
    };
  };
  for (const transformFilter of transformFilters) {
    build.onTransform(transformFilter, on_transform_callback);
  }
  for (const emitFilter of emitFilters) {
    build.onEmit(emitFilter, on_emit_callback);
  }
};

// src/plugins/importmeta/mod.ts
var importmetaPlugin = (config) => {
  return {
    name: "oazmi-superbuild-plugin-importmeta",
    setup: importmetaPluginSetup(config)
  };
};
export {
  cssPlugin,
  cssPluginSetup,
  defaultCssPluginSetupConfig,
  defaultHtmlPluginSetupConfig,
  defaultImportmetaPluginSetupConfig,
  htmlPlugin,
  htmlPluginSetup,
  importmetaPlugin,
  importmetaPluginSetup
};
