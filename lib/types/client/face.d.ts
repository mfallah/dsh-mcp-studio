/**
 * The props face this plugin hands to the slot framework.
 *
 * Why this module exists: the slot registration option `inject: () => face`
 * turns the returned object into component props. Anything placed there crosses
 * a boundary between "a live Cordis service" and "a React prop", and those two
 * have different rules.
 *
 * The rule that bit us: `ctx.locale` is a `LocaleRuntime` whose `subscribe` and
 * `getSnapshot` are PROTOTYPE methods that read `this`. Passing the service
 * itself puts an unbound method into props, and `useSyncExternalStore` invokes
 * `subscribe` as a bare function — so `this` is `undefined` and the panel's
 * first render throws. The visible result was a blank page.
 *
 * So the face is built here, once, with the methods bound and their identity
 * stable across renders. `useSyncExternalStore` resubscribes whenever
 * `subscribe` changes identity, so "stable" is a correctness requirement, not a
 * micro-optimisation: a fresh closure per call would thrash the subscription.
 *
 * @module @mfallah/dsh-mcp-studio/client/face
 */
import type { McpStudioController } from './state.js';
/**
 * The locale surface the panel reads.
 *
 * Deliberately structural and minimal: the panel needs the active language id
 * and change notifications, not the fourteen methods of the real service.
 */
export interface LocaleFace {
    getSnapshot(): {
        active: string;
    };
    subscribe(listener: () => void): () => void;
}
/**
 * What a locale service offers. `ctx.locale` satisfies this; the methods are
 * routinely `this`-dependent, which is exactly why callers must not forward the
 * object itself.
 */
export interface LocaleRuntimeLike {
    getSnapshot(): {
        active: string;
    };
    subscribe(listener: () => void): () => void;
}
/** Props the panel receives. `locale` is optional so the panel works alone. */
export interface StudioFace {
    controller: McpStudioController;
    locale?: LocaleFace;
}
/**
 * Build the props face for the panel.
 *
 * @param input.controller - the single state owner; passed through unchanged.
 * @param input.locale - the locale service, or undefined when absent. The
 *   service is not stored: only two bound closures over it are.
 * @returns a face whose `locale`, when present, is safe to hand to React.
 */
export declare function createStudioFace(input: {
    controller: McpStudioController;
    locale?: LocaleRuntimeLike | undefined | null;
}): StudioFace;
