export function Brand({ compact = false }) {
  return (
    <a className="brand" href="/" aria-label="Krishyak home">
      <img
        className="official-logo"
        src="/images/official-logo-100.png"
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
