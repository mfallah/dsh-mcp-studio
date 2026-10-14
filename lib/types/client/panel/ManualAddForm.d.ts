import type { Translate } from '../locales/keys.js';
import { type McpStudioController, type StudioSnapshot } from '../state.js';
/** @param props.snapshot - the subscribed panel snapshot (install errors). */
export declare function ManualAddForm({ t, controller, snapshot, }: {
    t: Translate;
    controller: McpStudioController;
    snapshot: StudioSnapshot;
}): import("react").JSX.Element;
