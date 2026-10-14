import type { ServerView } from '../../shared/contract.js';
import type { Translate } from '../locales/keys.js';
import { type McpStudioController, type StudioSnapshot } from '../state.js';
/** @param props.server - the server this drawer is showing. */
export declare function ServerDrawer({ t, controller, snapshot, server, }: {
    t: Translate;
    controller: McpStudioController;
    snapshot: StudioSnapshot;
    server: ServerView;
}): import("react").JSX.Element;
