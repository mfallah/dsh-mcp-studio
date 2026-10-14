/** Services this plugin needs before `apply` runs. */
export declare const inject: string[];
/**
 * Contribute the sidebar entry, the main panel, and the dictionaries.
 *
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: any): void;
export { McpStudioController } from './state.js';
export { createStudioApi, createHttpTransport, RPC_PATH, RPC_HEADER, StudioRpcError } from './rpc.js';
