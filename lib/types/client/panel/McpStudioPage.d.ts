import type { Translate } from '../locales/keys.js';
import { type McpStudioController } from '../state.js';
/** The locale service surface this page reads for direction. */
export interface LocaleFace {
    getSnapshot(): {
        active: string;
    };
    subscribe(listener: () => void): () => void;
}
/** Props the slot framework composes for this page. */
export interface StudioPanelProps {
    t: Translate;
    controller: McpStudioController;
    locale?: LocaleFace | undefined;
}
/**
 * Render the MCP Studio panel.
 *
 * @param props.controller - the single state owner, injected by `apply`.
 * @param props.locale - the locale service, read only for `dir`.
 */
export declare function McpStudioPanel({ t, controller, locale }: StudioPanelProps): import("react").JSX.Element;
