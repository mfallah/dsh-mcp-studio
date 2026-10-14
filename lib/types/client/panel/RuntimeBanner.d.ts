/**
 * Runtime availability banner: which local executables exist, and the exact
 * one-line command that installs each missing one.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/RuntimeBanner
 */
import type { RuntimeReport } from '../../shared/contract.js';
import type { LocaleKey, Translate } from '../locales/keys.js';
import type { AsyncView, McpStudioController } from '../state.js';
/** Every runtime the host probes, in display order, with its install hint. */
export declare const RUNTIME_ROWS: Array<{
    name: keyof RuntimeReport;
    hint: LocaleKey;
}>;
/**
 * Render the banner.
 *
 * @param props.view - the controller's runtime view.
 * @param props.controller - used for the retry affordance.
 */
export declare function RuntimeBanner({ t, view, controller, }: {
    t: Translate;
    view: AsyncView<RuntimeReport | null>;
    controller: McpStudioController;
}): import("react").JSX.Element | null;
