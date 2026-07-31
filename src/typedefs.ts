/** this module contains utility type definitions.
 *
 * @module
*/

import type { EsbuildPartialMessage } from "./deps.ts"


export interface EsbuildWarningsAndErrors {
	warnings?: Array<EsbuildPartialMessage>
	errors?: Array<EsbuildPartialMessage>
}
