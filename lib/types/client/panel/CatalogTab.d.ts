import type { Translate } from '../locales/keys.js';
import { type McpStudioController, type StudioSnapshot } from '../state.js';
/**
 * Render the catalog.
 *
 * @param props.snapshot - the subscribed panel snapshot.
 * @param props.controller - actions (query changes, opening the install sheet).
 */
export declare function CatalogTab({ t, controller, snapshot, }: {
    t: Translate;
    controller: McpStudioController;
    snapshot: StudioSnapshot;
}): import("react").JSX.Element;
