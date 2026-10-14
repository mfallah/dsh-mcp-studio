/**
 * Probe result rendering: ok, failure code, duration, and the discovered tools.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/ProbePanel
 */
import type { ProbeResult } from '../../../shared/contract.js';
import type { Translate } from '../../locales/keys.js';
import type { AsyncView } from '../../state.js';
/**
 * Render the last connection test.
 *
 * @param props.view - the controller's probe view.
 */
export declare function ProbePanel({ t, view }: {
    t: Translate;
    view: AsyncView<ProbeResult | null>;
}): import("react").JSX.Element;
