import { useState } from "react";
import { Globe2, Check } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "../../i18n/config";
import { useProductLocale } from "../../features/product/ProductLocale";
import { Dialog } from "./Dialog";

export function ProductLanguageChooser() {
  const { language, info, tx, loading, error, changeLanguage } =
    useProductLocale();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const options = Object.values(SUPPORTED_LANGUAGES).filter((row) =>
    [row.nativeName, row.name, row.region].some((value) =>
      value.toLocaleLowerCase().includes(needle),
    ),
  );
  return (
    <>
      <button
        className="language-picker__trigger"
        data-testid="workspace-language"
        type="button"
        aria-label={tx("Select language")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          // Safari does not focus a button when it is clicked. Capture a
          // reliable return target before the modal moves keyboard focus.
          event.currentTarget.focus();
          setOpen(true);
        }}
      >
        <Globe2 size={19} />
        <span lang={info.speechCode}>{info.nativeName}</span>
      </button>
      {open && (
        <Dialog
          title={tx("Choose your language")}
          onClose={() => {
            setOpen(false);
            setQuery("");
          }}
          className="language-dialog"
        >
          <p>
            {tx(
              "10 Indian languages and English. Text translations are machine generated and await native-speaker review.",
            )}
          </p>
          <label className="v2-label">
            {tx("Search language or region")}
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {error && <p role="alert">{tx(error)}</p>}
          {loading && (
            <p role="status">{tx("Opening the selected language…")}</p>
          )}
          <div className="language-options">
            {options.map((row) => (
              <button
                type="button"
                className="language-option"
                key={row.code}
                aria-pressed={language === row.code}
                disabled={loading}
                onClick={async () => {
                  if (await changeLanguage(row.code)) {
                    setOpen(false);
                    setQuery("");
                  }
                }}
              >
                <span>
                  <strong lang={row.speechCode} dir={row.direction}>
                    {row.nativeName}
                  </strong>
                  <small lang="en-IN" dir="ltr">
                    {row.name}
                  </small>
                </span>
                {language === row.code && (
                  <Check size={18} aria-label={tx("Selected")} />
                )}
              </button>
            ))}
          </div>
          {!options.length && (
            <p>
              {tx(
                "No language found. Try its name in English or its own script.",
              )}
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
