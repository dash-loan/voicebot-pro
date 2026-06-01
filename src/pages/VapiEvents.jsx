import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const EVENT_CONFIG = {
  'call.started': { label: 'שיחה התחילה', variant: 'default' },
  'call.ended':   { label: 'שיחה הסתיימה', variant: 'secondary' },
  'call.failed':  { label: 'שיחה נכשלה', variant: 'destructive' },
};

export default function VapiEvents() {
  const [eventFilter, setEventFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const { data: events = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['vapiWebhookEvents'],
    queryFn: () => base44.entities.VapiWebhookEvents.list('-created_date', 200),
    refetchInterval: 30000,
  });

  const filtered = events.filter(e => {
    if (eventFilter !== 'all' && e.event !== eventFilter) return false;
    if (dateFilter && e.received_at && !e.received_at.startsWith(dateFilter)) return false;
    return true;
  });

  const started = events.filter(e => e.event === 'call.started').length;
  const ended = events.filter(e => e.event === 'call.ended').length;
  const failed = events.filter(e => e.event === 'call.failed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">לוג אירועים</h1>
          <p className="text-muted-foreground mt-1">כל webhook שהתקבל מ-Vapi</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            {events.length} אירועים
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            רענן
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'שיחות שהתחילו', count: started, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'שיחות שהסתיימו', count: ended, cls: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'שיחות שנכשלו', count: failed, cls: 'bg-red-50 border-red-200 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.cls}`}>
            <p className="text-3xl font-bold">{s.count}</p>
            <p className="text-sm font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            {Object.entries(EVENT_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full sm:w-44" />
        {(eventFilter !== 'all' || dateFilter) && (
          <Button variant="outline" onClick={() => { setEventFilter('all'); setDateFilter(''); }}>נקה סינון</Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-medium text-muted-foreground">אין אירועים</p>
              <p className="text-sm text-muted-foreground mt-2">הטבלה תתמלא לאחר חיבור Vapi ופעילות שיחות</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>זמן</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead>Vapi Call ID</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>משך</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map(e => {
                  const cfg = EVENT_CONFIG[e.event] || { label: e.event, variant: 'outline' };
                  const dur = e.duration_seconds || 0;
                  const time = e.received_at || e.created_date;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {time ? format(new Date(time), 'dd/MM/yy HH:mm:ss', { locale: he }) : '—'}
                      </TableCell>
                      <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {e.call_id ? e.call_id.slice(0, 18) + '...' : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{e.phone_number || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {dur > 0 ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {filtered.length > 100 && <p className="text-center text-sm text-muted-foreground mt-4">מציג 100 מתוך {filtered.length}</p>}
        </CardContent>
      </Card>
    </div>
  );
}