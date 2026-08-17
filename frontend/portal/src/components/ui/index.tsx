import { forwardRef, useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Inbox, LoaderCircle, X } from 'lucide-react';

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }>(function Button({ variant = 'primary', className, ...props }, ref) {
  return <button ref={ref} className={cx('ui-button', `ui-button--${variant}`, className)} {...props} />;
});

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ui-card', className)} {...props} />;
}

export function MetricCard({ label, value, detail, icon, tone = 'default' }: { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  return <Card className="metric-card-v2"><div className={cx('metric-card-v2__icon', `is-${tone}`)}>{icon}</div><div><p className="metric-card-v2__label">{label}</p><strong className="metric-card-v2__value">{value}</strong>{detail && <p className="metric-card-v2__detail">{detail}</p>}</div></Card>;
}

export function ScoreCard({ score, change }: { score: number | null | undefined; change?: number }) {
  const hasScore = typeof score === 'number';
  const safeScore = hasScore ? Math.max(0, Math.min(100, score)) : 0;
  return <Card className="score-card"><div className="score-card__ring" style={{ '--score': `${safeScore * 3.6}deg` } as React.CSSProperties}>{hasScore ? <><span>{safeScore}</span><small>/100</small></> : <span className="score-card__unscored">Not scored</span>}</div><div><p className="eyebrow">Latest scan score</p><h2>Your latest completed privacy scan</h2><p className="muted">A scanner-generated measurement from the latest completed scan, not a legal compliance certification.</p>{typeof change === 'number' && <StatusBadge tone={change >= 0 ? 'success' : 'danger'}>{change >= 0 ? '+' : ''}{change} points since previous scan</StatusBadge>}</div></Card>;
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode }) {
  return <span className={cx('status-badge', `is-${tone}`)}>{children}</span>;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <div className="progress"><div className="progress__meta"><span>{label}</span><strong>{safeValue}%</strong></div><div className="progress__track"><span style={{ width: `${safeValue}%` }} /></div></div>;
}

export function FindingCard({ title, description, severity = 'warning', badgeLabel }: { title: string; description: string; severity?: 'danger' | 'warning' | 'info'; badgeLabel?: string }) {
  return <div className="finding-card"><StatusBadge tone={severity}>{badgeLabel || (severity === 'danger' ? 'Critical' : severity === 'warning' ? 'Review' : 'Info')}</StatusBadge><div><h3>{title}</h3><p>{description}</p></div></div>;
}

export function PriorityAction({ title, description, complete, onToggle }: { title: string; description: string; complete?: boolean; onToggle?: () => void }) {
  return <label className={cx('priority-action', complete && 'is-complete')}><input type="checkbox" checked={complete} onChange={onToggle} /><span><strong>{title}</strong><small>{description}</small></span></label>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="page-header-v2"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="route-heading" tabIndex={-1}>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-header-v2__actions">{actions}</div>}</header>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input className={cx('ui-input', props.className)} {...props} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={cx('ui-select', props.className)} {...props} />; }

export function Tabs({ items, active, onChange, label = 'Sections' }: { items: Array<{ id: string; label: string; panel?: ReactNode }>; active: string; onChange: (id: string) => void; label?: string }) {
  const instanceId = useId();
  const selectAt = (index: number) => {
    const item = items[(index + items.length) % items.length];
    onChange(item.id);
    requestAnimationFrame(() => document.getElementById(`${instanceId}-${item.id}-tab`)?.focus());
  };
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === active));
  const activeItem = items[currentIndex];
  return <><div className="ui-tabs" role="tablist" aria-label={label}>{items.map((item, index) => <button id={`${instanceId}-${item.id}-tab`} type="button" role="tab" aria-selected={active === item.id} aria-controls={`${instanceId}-${item.id}-panel`} tabIndex={active === item.id ? 0 : -1} className={active === item.id ? 'is-active' : ''} onKeyDown={(event) => { if (event.key === 'ArrowRight') selectAt(index + 1); if (event.key === 'ArrowLeft') selectAt(index - 1); if (event.key === 'Home') selectAt(0); if (event.key === 'End') selectAt(items.length - 1); }} onClick={() => onChange(item.id)} key={item.id}>{item.label}</button>)}</div>{activeItem?.panel !== undefined && <div id={`${instanceId}-${activeItem.id}-panel`} role="tabpanel" aria-labelledby={`${instanceId}-${activeItem.id}-tab`} tabIndex={0}>{activeItem.panel}</div>}</>;
}

export function Modal({ title, children, open, onClose }: { title: string; children: ReactNode; open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!elements.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = previousOverflow; previousFocus.current?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={onClose}><section ref={dialogRef} className="ui-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}><header><h2 id={titleId}>{title}</h2><Button variant="ghost" aria-label="Close dialog" onClick={onClose}><X size={18} /></Button></header>{children}</section></div>;
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'danger'; children: ReactNode }) { return <div className={cx('ui-alert', `is-${tone}`)} role={tone === 'danger' ? 'alert' : 'status'}>{children}</div>; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="empty-state-v2"><Inbox size={28} /><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function Skeleton({ className, label }: { className?: string; label?: string }) { return <div role={label ? 'status' : undefined} aria-live={label ? 'polite' : undefined}><div className={cx('ui-skeleton', className)} aria-hidden="true"><LoaderCircle /></div>{label && <span className="sr-only">{label}</span>}</div>; }

export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="table-scroll"><table className="ui-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
