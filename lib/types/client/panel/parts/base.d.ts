/**
 * Small presentational atoms for the MCP Studio panel.
 *
 * No component library is imported: the panel ships its own parts and styles
 * through `styles.ts`, so the bundle has exactly two externals (react and
 * react/jsx-runtime) and nothing else can break composition.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/base
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { ServerStatus } from '../../../shared/contract.js';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
    variant?: ButtonVariant;
    /** Renders a pending glyph and blocks a second click. */
    busy?: boolean;
    /** Accessible name for an icon-only control. */
    label?: string;
    icon?: ReactNode;
    children?: ReactNode;
}
/** A real `<button>` that refuses double submits and always has a name. */
export declare function Button({ variant, busy, label, icon, children, ...rest }: ButtonProps): import("react").JSX.Element;
export type TagTone = 'neutral' | 'ok' | 'warn' | 'error' | 'info';
/** A compact metadata badge. */
export declare function Tag({ tone, children }: {
    tone?: TagTone;
    children: ReactNode;
}): import("react").JSX.Element;
/** A toggleable filter chip; `aria-pressed` carries the state. */
export declare function Chip({ pressed, onClick, children, }: {
    pressed: boolean;
    onClick: () => void;
    children: ReactNode;
}): import("react").JSX.Element;
/**
 * Connection status, never colour-only: a glyph plus the translated label.
 */
export declare function StatusDot({ status, label }: {
    status: ServerStatus;
    label: string;
}): import("react").JSX.Element;
