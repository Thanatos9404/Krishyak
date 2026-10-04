export function Brand({ compact = false }) {
  return (
    <a className="brand" href="/" aria-label="Krishyak home">
      <img
        className="official-logo"
        src="/krishyak_logo.png"
        width="50"
        height="50"
        alt=""
      />
      {!compact && (
        <span>
          krishyak<span className="brand-dot">.</span>
        </span>
      )}
    </a>
  );
}
