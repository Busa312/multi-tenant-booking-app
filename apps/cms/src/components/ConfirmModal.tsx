import { useI18n } from "../i18n/I18nContext.js";
import { Modal } from "./Modal.js";
import { Button } from "./ui/index.js";

/** A question a page wants answered before it goes ahead. */
export interface ConfirmRequest {
  /** The action, as the heading — "Delete", "Cancel booking". */
  title: string;
  /** What will happen, in a sentence. */
  message: string;
  /** The button that goes ahead; names the action rather than saying "OK". */
  confirmLabel: string;
  /** The action destroys or cancels something. */
  danger?: boolean;
  run: () => void;
}

interface ConfirmModalProps {
  request: ConfirmRequest;
  onClose: () => void;
}

/**
 * The CMS's "are you sure?", in place of the browser's `confirm()`: same
 * theme, language and focus handling as every other dialog. Pages keep a
 * `ConfirmRequest | null` in state and mount this while it is set. The way out
 * says "Go back" rather than "Cancel", because one of the things being
 * confirmed is cancelling a booking.
 */
export function ConfirmModal({ request, onClose }: ConfirmModalProps) {
  const { t } = useI18n();

  return (
    <Modal
      title={request.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.goBack")}
          </Button>
          <Button
            danger={request.danger}
            onClick={() => {
              onClose();
              request.run();
            }}
          >
            {request.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-base-content/80">{request.message}</p>
    </Modal>
  );
}
