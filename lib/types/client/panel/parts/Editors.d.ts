/**
 * Editors for the two repeated shapes in every server config: an ordered
 * argument list, and a key/value map whose values may be secrets.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/Editors
 */
import type { Translate } from '../../locales/keys.js';
/** One editable map entry; ids keep React keys stable across edits. */
export interface KeyValueRow {
    id: string;
    key: string;
    value: string;
    /** When true the value is a `${secret:KEY}` reference, not a literal. */
    secret: boolean;
}
/** Create an empty row with a fresh stable id. */
export declare function createKeyValueRow(): KeyValueRow;
/**
 * Edit an ordered list of argument strings.
 *
 * @param props.values - the current arguments, in order.
 * @param props.onChange - called with the whole new list.
 * @param props.label - group label; also names the add control.
 */
export declare function ArgListEditor({ values, onChange, label, addLabel, t, }: {
    values: string[];
    onChange: (values: string[]) => void;
    label: string;
    addLabel: string;
    t: Translate;
}): import("react").JSX.Element;
/**
 * Edit a key/value map with per-row secret marking.
 *
 * A row marked secret is rendered as a password field and the caller converts
 * it into a `${secret:KEY}` placeholder before sending it to the host; the
 * literal value never lands in `servers.json`.
 */
export declare function KeyValueEditor({ rows, onChange, label, addLabel, keyPlaceholder, valuePlaceholder, secretLabel, t, }: {
    rows: KeyValueRow[];
    onChange: (rows: KeyValueRow[]) => void;
    label: string;
    addLabel: string;
    keyPlaceholder: string;
    valuePlaceholder: string;
    secretLabel: string;
    t: Translate;
}): import("react").JSX.Element;
