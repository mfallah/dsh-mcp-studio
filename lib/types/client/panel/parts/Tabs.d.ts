/**
 * A `role="tablist"` built from real buttons, usable with the keyboard.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/Tabs
 */
export interface TabItem<T extends string> {
    id: T;
    label: string;
}
/**
 * Render the tab strip.
 *
 * @param props.items - tab ids and their already-translated labels.
 * @param props.active - the selected tab id.
 * @param props.onChange - called with the newly selected id.
 * @param props.label - accessible name for the strip itself.
 */
export declare function Tabs<T extends string>({ items, active, onChange, label, }: {
    items: Array<TabItem<T>>;
    active: T;
    onChange: (id: T) => void;
    label: string;
}): import("react").JSX.Element;
