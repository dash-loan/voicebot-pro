import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Download, Eye, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import TranscriptViewer from '@/components/TranscriptViewer';
import { formatIsraeliPhone } from '@/utils/phoneUtils';

const STATUS = {
  interested:     { label: 'מעוניין',       color: 'default' },
  not_interested: { label: 'לא מעוניין',    color: 'destructive' },
  answered:       { label: 'ענה',           color: 'outline' },
  no_answer:      { label: 'לא ענה',        color: 'secondary' },
  voicemail:      { label: 'תא קולי',       color: 'secondary' },
};

const QUALITY = {
  hot_lead:       { label: '🔥 חם',     cls: 'bg-red-100 text-red-700 border-red-300' },
  warm_lead:      { label: '🟠 חמים',   cls: 'bg-orange-100 text-orange-700 border-orange-300' },
  qualified:      { label: '✅ מוסמך',  cls: 'bg-green-100 text-green-700 border-green-300' },
  not_interested: { label: '✗ לא מעוניין', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  unqualified:    { label: '— לא מוסמך', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function exportCSV(logs, filename) {
  const headers = ['שם', 'טלפון', 'קמפיין', 'תוצאה', 'איכות ליד', 'ציון', 'משך', 'תאריך', 'תמלול'];
  const rows = logs.map(l => [
    `"${l.contact_name || ''}"`,
    l.contact_phone || '',
    `"${l.campaign_name || ''}"`,
    STATUS[l.status]?.label || l.status,
    QUALITY[l.lead_quality]?.label || l.lead_quality || '',
    l.quality_score || 0,
    l.duration ? `${Math.floor(l.duration / 60)}:${String(l.duration % 60).padStart(2, '0')}` : '',
    l.created_date ? format(new Date(l.created_date), 'dd/MM/yyyy HH:mm', { locale: he }) : '',
    `"${(l.transcript || '').replace(/"/g, '""')}"`,
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export default function RelevantContacts() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: callLogs = [], isLoading } = useQuery({
    queryKey: ['myCallLogs', user?.id],
    queryFn: () => base44.entities.CallLog.filter({ client_id: user?.id }, '-created_date'),
    enabled: !!user?.id,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['myCampaigns', user?.id],
    queryFn: () => base44.entities.Campaign.filter({ client_id: user?.id }),
    enabled: !!user?.id,
  });

  const filtered = callLogs.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (qualityFilter !== 'all' && l.lead_quality !== qualityFilter) return false;
    if (campaignFilter !== 'all' && l.campaign_id !== campaignFilter) return false;
    if (dateFilter && l.created_date && !l.created_date.startsWith(dateFilter)) return false;
    if (search && !l.contact_name?.includes(search) && !l.contact_phone?.includes(search)) return false;
    return true;
  });

  const hotLeads = callLogs.filter(l => l.lead_quality === 'hot_lead');
  const warmLeads = callLogs.filter(l => l.lead_quality === 'warm_lead');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">כל השיחות</h1>
          <p className="text-muted-foreground mt-1">{callLogs.length} שיחות · {hotLeads.length} לידים חמים 🔥</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportCSV(hotLeads, 'לידים-חמים.csv')} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
            <Flame className="w-4 h-4" /> ייצא לידים חמים ({hotLeads.length})
          </Button>
          <Button onClick={() => exportCSV([...hotLeads, ...warmLeads], 'מעוניינים.csv')} variant="outline" className="gap-2">
            ייצא מעוניינים ({hotLeads.length + warmLeads.length})
          </Button>
          <Button variant="outline" onClick={() => exportCSV(filtered, 'הכל.csv')} className="gap-2">
            <Download className="w-4 h-4" /> ייצא הכל
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'לידים חמים 🔥', count: hotLeads.length, cls: 'bg-red-50 text-red-700 border-red-200' },
          { label: 'חמים חלקית', count: warmLeads.length, cls: 'bg-orange-50 text-orange-700 border-orange-200' },
          { label: 'לא ענו', count: callLogs.filter(l => l.status === 'no_answer').length, cls: 'bg-gray-50 text-gray-600 border-gray-200' },
          { label: 'תא קולי', count: callLogs.filter(l => l.status === 'voicemail').length, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-lg p-4 ${s.cls}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-sm font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3 flex-wrap">
            <Input placeholder="חיפוש שם / טלפון..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[150px]" />
            <Select value={qualityFilter} onValueChange={setQualityFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="איכות ליד" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל האיכויות</SelectItem>
                {Object.entries(QUALITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="סטטוס" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="קמפיין" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקמפיינים</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full md:w-40" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">לא נמצאו שיחות</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>קמפיין</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>איכות ליד</TableHead>
                  <TableHead>משך</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map(log => (
                  <TableRow key={log.id} className={log.lead_quality === 'hot_lead' ? 'bg-red-50/30' : log.lead_quality === 'warm_lead' ? 'bg-orange-50/30' : ''}>
                    <TableCell className="font-medium">{log.contact_name || '-'}</TableCell>
                    <TableCell className="font-mono" dir="ltr">{log.contact_phone ? formatIsraeliPhone(log.contact_phone) : '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.campaign_name || '-'}</TableCell>
                    <TableCell><Badge variant={STATUS[log.status]?.color}>{STATUS[log.status]?.label || log.status}</Badge></TableCell>
                    <TableCell>
                      {log.lead_quality && QUALITY[log.lead_quality] ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${QUALITY[log.lead_quality].cls}`}>
                          {QUALITY[log.lead_quality].label}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{log.duration ? `${Math.floor(log.duration / 60)}:${String(log.duration % 60).padStart(2, '0')}` : '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.created_date ? format(new Date(log.created_date), 'dd/MM HH:mm', { locale: he }) : '-'}</TableCell>
                    <TableCell>
                      {(log.transcript || log.transcript_json) && (
                        <Button size="sm" variant="ghost" onClick={() => setViewing(log)}><Eye className="w-4 h-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length > 100 && <p className="text-center text-sm text-muted-foreground mt-4">מציג 100 מתוך {filtered.length}</p>}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>תמלול שיחה – {viewing?.contact_name}</DialogTitle>
          </DialogHeader>
          <TranscriptViewer transcriptJson={viewing?.transcript_json} transcriptText={viewing?.transcript} />
          {viewing?.transcript && (
            <Button variant="outline" className="w-full mt-2" onClick={() => {
              const blob = new Blob([viewing.transcript], { type: 'text/plain;charset=utf-8' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `תמלול-${viewing.contact_name || viewing.id}.txt`;
              a.click();
            }}>
              <Download className="w-4 h-4 ml-2" /> הורד תמלול
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}