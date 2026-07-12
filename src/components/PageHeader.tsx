export function PageHeader({ eyebrow, title, subtitle, extra }: { eyebrow: string; title: string; subtitle: string; extra?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Space Grotesk'", fontSize: 11.5, letterSpacing: '.16em', color: 'oklch(0.5 0.06 165)' }}>{eyebrow}</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.01em', marginTop: 3 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: 'oklch(0.55 0.01 60)', marginTop: 4 }}>{subtitle}</div>
      </div>
      {extra}
    </div>
  );
}
