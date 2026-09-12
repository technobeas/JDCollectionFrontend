import { X } from "lucide-react";

export default function ConfirmModal({
  open,
  title = "Are you sure?",
  message,
  confirmText = "Delete",
  onConfirm,
  onClose,
  busy = false,
  busyText = "Deleting...",
  showCancel = true,
  danger = true,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="confirm-modal-title" className="text-xl font-black">
              {title}
            </h2>

            {message && (
              <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
            )}
          </div>

          <button
            type="button"
            className="btn-soft p-2"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {showCancel && (
            <button
              type="button"
              className="btn-soft"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            className={
              danger
                ? "btn bg-red-600 text-white hover:bg-red-700"
                : "btn-primary"
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyText : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
