import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Filter, Download, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export default function CallResults() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [viewingLog, setViewingLog] = useState(null);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: callLogs = [], isLoading } = useQuery({
    queryKey: ['myCallLogs', user?.id],
    queryFn: () => base44.entities.CallLog.filter({ client_id: user?.id }, '-created_date'),
    enabled: !!user?.id
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['myCampaigns', user?.id],
    queryFn: () => base44.entities.Campaign.filter({ client_id: user?.id }),
    enabled: !!user?.id
  });

  const filteredLogs = callLogs.filter(log => {
    const matchesSearch = !search || 
      log.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.contact_phone?.includes(search);
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesCampaign = campaignFilter === 'all' || log.campaign_id === campaignFilter;
    return matchesSearch && matchesStatus && matchesCampaign;
  });

  const statusLabels = { answered: 'ענה', voicemail: 'תא קולי', no_answer: 'לא ענה', interested: 'מעוניין', not_interested: 'לא מעוניין' };
  const statusColors = { interested: 'default', not_interested: 'destructive', answered: 'outline', voicemail: 'secondary', no_answer: 'secondary' };

  const exportToCSV = () => {
    const headers = ['שם', 'טלפון', 'קמפיין', 'סטטוס', 'משך', 'תאריך'];
    const rows = filteredLogs.map(log => [
      log.contact_name || '',
      log.contact_phone || '',
      log.campaign_name || '',
      statusLabels[log.status] || log.status,
      log.duration ? `${Math.floor(log.duration / 60)}:${String(log.duration % 60).padStart(2, '0')}` : '',
      log.created_date ? format(new Date(log.created_date), 'dd/MM/yyyy HH:mm', { locale: he }) : ''
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `call-results-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">תוצאות שיחות</h1>
          <p className="text-muted-foreground mt-1">{callLogs.length} שיחות</p>
        </div>
        <Button variant="outline" onClick={exportToCSV} className="gap-2">
          <Download className="w-4 h-4" /> ייצוא לExcel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="חיפוש לפי שם או טלפון..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="interested">מעוניין</SelectItem>
                <SelectItem value="not_interested">לא מעוניין</SelectItem>
                <SelectItem value="answered">ענה</SelectItem>
                <SelectItem value="no_answer">לא ענה</SelectItem>
                <SelectItem value="voicemail">תא קולי</SelectItem>
              </SelectContent>
            </Select>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="קמפיין" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקמפיינים</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">לא נמצאו שיחות</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>קמפיין</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>משך</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.slice(0, 50).map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.contact_name || '-'}</TableCell>
                    <TableCell className="font-mono" dir="ltr">{log.contact_phone || '-'}</TableCell>
                    <TableCell>{log.campaign_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[log.status]}>{statusLabels[log.status] || log.status}</Badge>
                    </TableCell>
                    <TableCell>{log.duration ? `${Math.floor(log.duration / 60)}:${String(log.duration % 60).padStart(2, '0')}` : '-'}</TableCell>
                    <TableCell>{log.created_date ? format(new Date(log.created_date), 'dd/MM HH:mm', { locale: he }) : '-'}</TableCell>
                    <TableCell>
                      {log.transcript && (
                        <Button size="sm" variant="outline" onClick={() => setViewingLog(log)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filteredLogs.length > 50 && <p className="text-center text-sm text-muted-foreground mt-4">מציג 50 מתוך {filteredLogs.length}</p>}
        </CardContent>
      </Card>

      <Dialog open={!!viewingLog} onOpenChange={() => setViewingLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>תמלול שיחה - {viewingLog?.contact_name}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 whitespace-pre-wrap text-sm">
            {viewingLog?.transcript || 'אין תמלול זמין'}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}