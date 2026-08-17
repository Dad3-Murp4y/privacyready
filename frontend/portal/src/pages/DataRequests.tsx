import { useEffect, useState } from 'react';
import { Alert, Card, EmptyState, PageHeader, Select, Skeleton, StatusBadge } from '../components/ui';
import PremiumGate from '../components/PremiumGate';
import { usePortal } from '../contexts/PortalContext';
import type { DsrRecord } from '../types/portal';
import { useAuth } from '../contexts/AuthContext';

const statusTone = (status: string) => status === 'COMPLETED' ? 'success' : status === 'REJECTED' ? 'danger' : 'warning';

export default function DataRequests() {
  const { user } = useAuth();
  const { isPremium, invalidatePremium } = usePortal();
  const canManage = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const [records, setRecords] = useState<DsrRecord[]>([]); const [loading, setLoading] = useState(isPremium); const [error, setError] = useState('');
  useEffect(() => {
    if (!isPremium) { setRecords([]); setLoading(false); return; }
    const load = async () => { setLoading(true); try { const response = await fetch(`${import.meta.env.VITE_API_URL}/api/dsr`, { credentials: 'include' }); if (response.status === 403) invalidatePremium(); if (!response.ok) throw new Error('Data requests could not be loaded.'); setRecords(await response.json()); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Data requests could not be loaded.'); setRecords([]); } finally { setLoading(false); } };
    void load();
  }, [invalidatePremium, isPremium]);
  const update = async (id: string, status: string) => { setError(''); const response = await fetch(`${import.meta.env.VITE_API_URL}/api/dsr/${id}`, { credentials: 'include', method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); if (response.status === 403) invalidatePremium(); if (!response.ok) { setError('The data request could not be updated.'); return; } setRecords((current) => current.map((record) => record.id === id ? { ...record, status } : record)); };
  return <><PageHeader eyebrow="Individual rights" title="Data subject requests" description="Track requests, statutory deadlines, and the next required action while minimising requester information in list views." /><PremiumGate>{error && <Alert tone="danger">{error}</Alert>}{loading ? <Skeleton label="Loading data requests" /> : records.length === 0 ? <Card><EmptyState title="No data requests" description="Requests submitted through your public intake or logged by your team will appear here." /></Card> : <div className="record-grid">{records.map((record) => { const due = new Date(record.dueDate); const overdue = due.getTime() < Date.now() && record.status !== 'COMPLETED'; return <Card className="record-card" key={record.id}><div className="record-card__header"><StatusBadge tone={overdue ? 'danger' : statusTone(record.status)}>{overdue ? 'Overdue' : record.status.toLowerCase().replaceAll('_', ' ')}</StatusBadge><span>Due {due.toLocaleDateString('en-GB')}</span></div><h2>{record.requestType.toLowerCase().replaceAll('_', ' ')}</h2><p className="muted">Requester: {record.subjectEmail.replace(/(^.).*(@.*$)/, '$1•••$2')}</p>{canManage ? <><label htmlFor={`status-${record.id}`}>Update status</label><Select id={`status-${record.id}`} value={record.status} onChange={(event) => { void update(record.id, event.target.value); }}><option value="PENDING">New</option><option value="IN_REVIEW">In progress</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="COMPLETED">Completed</option></Select></> : <p className="muted">An organisation administrator manages status changes.</p>}</Card>; })}</div>}</PremiumGate></>;
}
