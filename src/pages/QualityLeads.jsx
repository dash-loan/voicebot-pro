import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Download, Eye, Flame, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import TranscriptViewer from '@/components/TranscriptViewer';
import { formatIsraeliPhone } from '@/utils/phoneUtils';

const QUALITY_CONFIG = {
  hot_lead:       { label: 'ליד חם 🔥',       bg: 'bg-red-100 text-red-700 border-red-300',    badge: 'destructive' },
  warm_lead:      { label: 'ליד חמים',         bg: 'bg-orange-100 text-orange-700 border-orange-300', badge: 'outline' },
  qualified:      { label: 'מוסמך',            bg: 'bg-green-100 text-green-700 border-green-300',  badge: 'outline' },
  not_interested: { label: 'לא מעוניין',       bg: 'bg-gray-100 text-gray-600 border-gray-200',   badge: 'secondary' },
  unqualified:    { label: 'לא מוסמך',         bg: 'bg-slate-100 text-slate-500 border-slate-200', badge: 'secondary' },
};

function QualityBadge({ quality, score }) {
  const cfg = QUALITY_CONFIG[quality] || QUALITY_CONFIG.unqualified;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.bg}`}>
      {cfg.label}
      {score > 0 && <span className="opacity-70">({score})</span>}
    </span>
  );
}

function exportLeadsCSV(logs, filename) {
  const headers = ['שם', 'טלפון', 'קמפיין', 'איכות ליד', 'ציון', 'משך', 'תאריך', 'תמלול'];
  const rows = logs.map(l => [
    `"${l.contact_name || ''}"`,
    l.contact_phone || '',
    `"${l.campaign_name || ''}"`,
    QUALITY_CONFIG[l.lead_quality]?.label || l.lead_quality || '',
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

export default function QualityLeads() {
  const [qualityFilter, setQualityFilter] = useState('hot_warm');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: callLogs = [], isLoading } = useQuery({
    queryKey: ['myCallLogs', user?.id],
    queryFn: () => base44.entities.CallLog.filter({ client_id: user?.id }, '-quality_score'),
    enabled: !!user?.id,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['myCampaigns', user?.id],
    queryFn: () => base44.entities.Campaign.filter({ client_id: user?.id }),
    enabled: !!user?.id,
  });

  const filtered = callLogs
    .filter(l => {
      if (qualityFilter === 'hot_warm') return l.lead_quality === 'hot_lead' || l.lead_quality === 'warm_lead';
      if (qualityFilter === 'hot') return l.lead_quality === 'hot_lead';
      if (qualityFilter === 'warm') return l.lead_quality === 'warm_lead';
      if (qualityFilter === 'all') return true;
      return l.lead_quality === qualityFilter;
    })
    .filter(l => campaignFilter === 'all' || l.campaign_id === campaignFilter)
    .filter(l => !search || l.contact_name?.includes(search) || l.contact_phone?.includes(search))
    .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));

  const hotCount = callLogs.filter(l => l.lead_quality === 'hot_lead').length;
  const warmCount = callLogs.filter(l => l.lead_quality === 'warm_lead').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Flame className="w-8 h-8 text-orange-500" /> לידים איכותיים
          </h1>
          <p className="text-muted-foreground mt-1">{hotCount} חמים 🔥 · {warmCount} חמים חלקית</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportLeadsCSV(callLogs.filter(l => l.lead_quality === 'hot_lead'), 'לידים-חמים.csv')}
            className="gap-2 bg-red-600 hover:bg-red-700 text-white">
            <Flame className="w-4 h-4" /> ייצא לידים חמים ({hotCount})
          </Button>
          <Button variant="outline" onClick={() => exportLeadsCSV(filtered, 'לידים-איכותיים.csv')} className="gap-2">
            <Download className="w-4 h-4" /> ייצא את כולם
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'לידים חמים 🔥', count: hotCount, bg: 'bg-red-50 border-red-200 text-red-700' },
          { label: 'חמים חלקית', count: warmCount, bg: 'bg-orange-50 border-orange-200 text-orange-700' },
          { label: 'סה"כ מוסמכים', count: callLogs.filter(l => l.lead_quality === 'qualified').length, bg: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'מתוך סה"כ', count: callLogs.length, bg: 'bg-blue-50 border-blue-200 text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.bg}`}>
            <p className="text-3xl font-black">{s.count}</p>
            <p className="text-sm font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="חיפוש שם / טלפון..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
            <Select value={qualityFilter} onValueChange={setQualityFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hot_warm">חמים + חמים חלקית</SelectItem>
                <SelectItem value="hot">חמים בלבד 🔥</SelectItem>
                <SelectItem value="warm">חמים חלקית</SelectItem>
                <SelectItem value="all">הכל</SelectItem>
              </SelectContent>
            </Select>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="כל הקמפיינים" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקמפיינים</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Flame className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-medium text-muted-foreground">אין לידים איכותיים עדיין</p>
              <p className="text-sm text-muted-foreground mt-2">הפעל קמפיין כדי להתחיל לקבל לידים</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(lead => (
                <div key={lead.id} className={`border rounded-xl p-4 hover:shadow-md transition-all ${lead.lead_quality === 'hot_lead' ? 'border-red-200 bg-red-50/30' : lead.lead_quality === 'warm_lead' ? 'border-orange-200 bg-orange-50/30' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-bold text-lg">{lead.contact_name || 'לא ידוע'}</p>
                        <QualityBadge quality={lead.lead_quality} score={lead.quality_score} />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> <span dir="ltr">{lead.contact_phone ? formatIsraeliPhone(lead.contact_phone) : '-'}</span></span>
                        <span>{lead.campaign_name || '-'}</span>
                        {lead.created_date && <span>{format(new Date(lead.created_date), 'dd/MM/yyyy HH:mm', { locale: he })}</span>}
                      </div>
                      {lead.transcript && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 bg-muted/50 rounded p-2">
                          {lead.transcript.substring(0, 150)}{lead.transcript.length > 150 ? '...' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.transcript && (
                        <Button size="sm" variant="outline" onClick={() => setViewing(lead)} className="gap-1">
                          <Eye className="w-4 h-4" /> תמלול
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              תמלול שיחה – {viewing?.contact_name}
              {viewing && <QualityBadge quality={viewing.lead_quality} score={viewing.quality_score} />}
            </DialogTitle>
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