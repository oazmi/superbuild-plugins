/** this module contains type definitions for super-build's extended plugin api.
 *
 * @module
*/
/** this symbol gives you access to the **true** internal `PluginBuild` object that was used for constructing a {@link SuperPluginBuild}.
 * it can be used as a means to check whether you're inside super-build or not,
 * or if you have a situation where it is necessary for super-build to be bypassed,
 * such as in the case of {@link EsbuildNativeResolver}, which is spawned by {@link nativeReplicaPluginSetup}.
 *
 * > [!caution]
 * > for plugin writers, it is recommended that you use the {@link SuperPluginBuild.getInnerEsbuildPluginBuild}
 * > instead of this symbol to access the underlying `PluginBuild`, because otherwise,
 * > your plugin will have to import this symbol as an object from this library,
 * > meaning that your plugin will place a hard dependency on **this version** of the super-build library,
 * > which will mean that if your plugin gets used under a different version of the super-build library,
 * > your plugin will fail to acquire the **true** underlying esbuild object due to `symbol` mismatch between the two library versions.
*/
export const INNER_PLUGIN_BUILD = Symbol();
