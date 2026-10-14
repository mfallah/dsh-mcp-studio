/**
 * A modal sheet: Escape closes it, focus starts inside, Tab stays inside, and
 * the backdrop is a real button so pointer users can dismiss it too.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/Overlay
 */
import { type ReactNode } from 'react';
/**
 * Render a modal overlay.
 *
 * @param props.title - visible heading, wired as the dialog's accessible name.
 * @param props.onClose - called on Escape, backdrop click, and the close button.
 * @param props.closeLabel - accessible name for the close control.
 * @param props.footer - optional action row pinned under the body.
 * @param props.wide - use the wider sheet for the server drawer.
 */
export declare function Overlay({ title, subtitle, onClose, closeLabel, children, footer, wide, titleId, }: {
    title: ReactNode;
    subtitle?: ReactNode;
    onClose: () => void;
    closeLabel: string;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
    titleId?: string;
}): import("react").JSX.Element;
