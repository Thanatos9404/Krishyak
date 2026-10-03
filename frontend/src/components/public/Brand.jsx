export function Brand({ compact = false }) {
  return (
    <a className="brand" href="/" aria-label="Krishyak home">
      <svg
        width="34"
        height="36"
        viewBox="0 0 34 36"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 30V11M6 24C6 12 16 5 28 5C29 18 20 26 6 24Z"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 23L20 12M12 28L25 28M12 33L30 33"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <span>
          krishyak<span className="brand-dot">.</span>
        </span>
      )}
    </a>
  );
}
