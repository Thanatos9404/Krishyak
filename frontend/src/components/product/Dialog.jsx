import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { trapDialogFocus } from "../../utils/dialogFocus";

export function Dialog({ title, children, onClose, className = "" }) {
  const ref = useRef(null),
    heading = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    ref.current.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={heading}
      className={`product-dialog ${className}`}
      onCancel={onClose}
      onKeyDown={trapDialogFocus}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <header>
        <h2 id={heading}>{title}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
