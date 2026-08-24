/**
 * Shared visual for every generated PWA icon size — a single source so the
 * mark stays identical across favicon, apple-touch-icon, and manifest
 * icons instead of drifting between hand-copied JSX blocks.
 */
export function ManguifiMark({ scale = 1 }: { scale?: number }) {
  const s = 20 * scale;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth={2.2} />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth={2.2} />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth={2.2} />
      <path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z" fill="white" />
    </svg>
  );
}
