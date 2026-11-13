import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nContext.js";
import { Icon } from "./ui/Icon.js";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Sits in the header beside the close button — e.g. the form's content-language picker. */
  headerAction?: ReactNode;
}

/**
 * daisyUI modal on a native <dialog>, opened with showModal() so the browser
 * supplies the focus trap, Escape handling and inert background. Callers
 * mount it to open and unmount it to close, so Escape and backdrop clicks
 * route through `onClose` rather than closing the dialog behind React's back.
 * Phones get a bottom sheet; `sm` and up a centred box.
 */
export function Modal({ title, onClose, children, footer, headerAction }: ModalProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first focusable thing, which is whatever sits in
      // the header (the content-language picker, the close button). Start in the
      // form instead. Not on touch screens: focusing a field there raises the
      // keyboard over the sheet before it has been read, so the body takes it.
      const firstField = bodyRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]):not(:disabled), textarea:not(:disabled), [role=combobox]:not(:disabled)",
      );
      const typing = window.matchMedia?.("(pointer: fine)").matches;
      (typing && firstField ? firstField : bodyRef.current)?.focus();
    }
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box flex max-h-[90dvh] flex-col p-0 sm:max-w-lg">
        <div className="flex items-center gap-3 border-b border-base-300 px-5 py-4 sm:px-6">
          <h2 id={titleId} className="font-display text-2xl leading-tight font-bold">
            {title}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {headerAction}
            <button type="button" className="btn btn-square btn-ghost btn-sm" onClick={onClose} aria-label={t("common.close")}>
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div ref={bodyRef} tabIndex={-1} className="flex-1 overflow-y-auto px-5 py-5 outline-none sm:px-6">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-base-300 bg-base-200/40 px-5 py-4 max-sm:[&>*]:flex-1 sm:px-6">
            {footer}
          </div>
        )}
      </div>
      <div className="modal-backdrop bg-neutral/50" onClick={onClose} aria-hidden="true" />
    </dialog>
  );
}
