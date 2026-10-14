import type { ServerStatus } from '../../shared/contract.js';
import type { LocaleKey, Translate } from '../locales/keys.js';
import { type McpStudioController, type StudioSnapshot } from '../state.js';
/** Translated label for each lifecycle state. */
export declare const STATUS_LABEL: Record<ServerStatus, LocaleKey>;
/** @param props.snapshot - the subscribed panel snapshot. */
export declare function InstalledTab({ t, controller, snapshot, }: {
    t: Translate;
    controller: McpStudioController;
    snapshot: StudioSnapshot;
}): import("react").JSX.Element;
