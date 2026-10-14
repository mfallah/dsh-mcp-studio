/**
 * Accessible form fields: one label, one control, hints and errors wired to
 * `aria-describedby`, and no `placeholder` standing in for a label.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/Field
 */
import { type ReactNode } from 'react';
interface CommonFieldProps {
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    disabled?: boolean;
    id?: string;
}
/** One-line text input (also used for numbers and passwords via `type`). */
export declare function TextField({ label, value, onChange, placeholder, hint, error, type, disabled, required, readOnly, mono, id, autoFocus, inputMode, }: CommonFieldProps & {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: 'text' | 'number' | 'password' | 'url';
    required?: boolean;
    readOnly?: boolean;
    mono?: boolean;
    autoFocus?: boolean;
    inputMode?: 'text' | 'numeric' | 'url';
}): import("react").JSX.Element;
/** Multi-line input, monospaced by default because most here are config blobs. */
export declare function TextAreaField({ label, value, onChange, placeholder, hint, error, disabled, rows, id, }: CommonFieldProps & {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
}): import("react").JSX.Element;
/** Native select; the option list is translated by the caller. */
export declare function SelectField({ label, value, onChange, options, hint, disabled, id, }: CommonFieldProps & {
    value: string;
    onChange: (value: string) => void;
    options: Array<{
        value: string;
        label: string;
    }>;
}): import("react").JSX.Element;
/** A labelled checkbox used for booleans and per-row secret markers. */
export declare function CheckboxField({ label, checked, onChange, hint, disabled, }: {
    label: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    hint?: ReactNode;
    disabled?: boolean;
}): import("react").JSX.Element;
export {};
