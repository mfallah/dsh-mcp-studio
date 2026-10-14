import type { CatalogEntry } from '../../shared/contract.js';
import type { Translate } from '../locales/keys.js';
import { type McpStudioController, type StudioSnapshot } from '../state.js';
/**
 * Render the install sheet for one catalog entry.
 *
 * @param props.entry - the entry being installed.
 * @param props.snapshot - the subscribed panel snapshot (probe + errors).
 */
export declare function InstallSheet({ t, controller, snapshot, entry, }: {
    t: Translate;
    controller: McpStudioController;
    snapshot: StudioSnapshot;
    entry: CatalogEntry;
}): import("react").JSX.Element;
