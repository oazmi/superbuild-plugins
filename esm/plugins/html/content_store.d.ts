/** this module exports a content-storage for storing and loading inlined contents in your html files.
 * only a single instance of {@link ContentStore} is needed per build.
 *
 * TODO: consider if this module should be moved up top,
 * since it is generic enough to be useful for other plugins that I plan on adding later.
 *
 * @module
*/
import type { OnLoadResult, SuperPluginBuild } from "../../deps.js";
type FileId = number & {};
/** this interface describes an virtual file entry stored inside {@link ContentStore}. */
interface ContentStoreFile extends ContentStoreAddFile {
    /** the resource's unique id number. */
    id: FileId;
    /** the contents of the resource. */
    contents: Uint8Array<ArrayBuffer>;
}
export interface ContentStoreAddFile {
    /** this resource's importer's resolved path. */
    importerPath: string;
    /** this resource's importer's resolved namespace. */
    importerNamespace?: string;
    /** the loader to be used on this resource. */
    loader: OnLoadResult["loader"];
    /** the contents of this virtual resource. */
    contents: string | Uint8Array<ArrayBuffer>;
}
export declare class ContentStore {
    /** the prefix that must be attached to stored resources' initial path (i.e. the path passed to `build.resolve(...)`). */
    readonly prefix: string;
    /** the namespace that will be attached to resolved virtual contents' "path". */
    readonly namespace: string;
    /** contains all of the files inserted via the {@link add} method. */
    protected files: Map<FileId, ContentStoreFile>;
    /** contains all of the emitted files that originated from the virtual resource {@link files}. */
    protected outputFiles: Map<FileId, ContentStoreFile>;
    /** a unique resource id that is incremented for each new resource. */
    private resourceId;
    constructor(build: SuperPluginBuild);
    /** encode a virtual resource file's id to an esbuild-resolvable path.
     *
     * the reason why encode the virtual file in a certain way is because we want its content's relative references to still stay intact.
     * the way by which we encode the resource path is: `${importer_dir}/${prefix}${id}`,
     * where `importer_dir` is the directory of `importer.importerPath`, and `prefix` is {@link prefix}.
    */
    protected encodeResolvedPath(id: FileId, importer: Pick<ContentStoreAddFile, "importerPath">): string;
    /** decode the output of {@link encodeResolvedPath} to get back the original unique file/resource {@link FileId} from it. */
    protected decodeResolvedPath(resolved_path: string): FileId;
    /** acquire a unique new resource id. */
    protected newId(): FileId;
    /** add a new content to this content-storage.
     * the returned value will reflect the unique resource id assigned to your newly added content.
    */
    add(config: ContentStoreAddFile): string;
    /** load a content from the content-storage, based on the unique resource file path it was assigned during the {@link add} method. */
    getInput(resolved_path: string): ContentStoreFile;
    /** get the contents of the bundled/emitted output virtual resource. */
    getOutput(resolved_path: string): ContentStoreFile;
}
export {};
//# sourceMappingURL=content_store.d.ts.map