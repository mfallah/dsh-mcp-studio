/**
 * Render `code` in a `<pre>` with a copy button.
 *
 * @param props.code - the text to show and copy.
 * @param props.copyLabel - button label before copying.
 * @param props.copiedLabel - confirmation after a successful copy.
 * @param props.failedLabel - what to say when the clipboard API is unavailable.
 */
export declare function CodeBlock({ code, copyLabel, copiedLabel, failedLabel, }: {
    code: string;
    copyLabel: string;
    copiedLabel: string;
    failedLabel: string;
}): import("react").JSX.Element;
