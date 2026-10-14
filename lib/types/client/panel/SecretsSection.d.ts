import type { Translate } from '../locales/keys.js';
import { type McpStudioController, type StudioSnapshot } from '../state.js';
/** @param props.snapshot - the subscribed panel snapshot. */
export declare function SecretsSection({ t, controller, snapshot, }: {
    t: Translate;
    controller: McpStudioController;
    snapshot: StudioSnapshot;
}): import("react").JSX.Element;
