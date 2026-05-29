import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, Webhook } from 'lucide-react';

const eventLabels = {
  'call.started': { label: 'שיחה התחילה', color: 'default' },
  'call.ended': { label: 'שיחה הסתיימה', color: 'secondary' },
  'call.failed': { label: 'שיחה נכשלה', color: 'destructive' },
};

export default function VapiEvents() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['vapiWebhookEvents'],
    queryFn: () => base44.entities.VapiWebhookEvents.list('-created_date', 100),
    refetchInterval: 30000
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">אירועי Vapi Webhook</h1>
          <p className="text-muted-foreground mt-1">לוג של כל האירועים שהתקבלו מ-Vapi</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="w-4 h-4" />
          {events.length} אירועים
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <Webhook className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-medium text-muted-foreground">אין אירועים עדיין</p>
              <p className="text-sm text-muted-foreground mt-2">הטבלה תתמלא לאחר חיבור Vapi ופעילות שיחות</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>זמן</TableHead>
                  <TableHead>סוג אירוע</TableHead>
                  <TableHead>מספר טלפון</TableHead>
                  <TableHead>Vapi Call ID</TableHead>
                  <TableHead>משך שיחה</TableHead>
                  <TableHead>קמפיין</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map(e => {
                  const meta = eventLabels[e.event] || { label: e.event, color: 'outline' };
                  const durMin = Math.floor((e.duration_seconds || 0) / 60);
                  const durSec = (e.duration_seconds || 0) % 60;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {e.received_at ? new Date(e.received_at).toLocaleString('he-IL') : new Date(e.created_date).toLocaleString('he-IL')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.color}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{e.phone_number || '—'}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{e.call_id ? e.call_id.slice(0, 16) + '...' : '—'}</TableCell>
                      <TableCell>{e.duration_seconds > 0 ? `${durMin}:${String(durSec).padStart(2, '0')}` : '—'}</TableCell>
                      <TableCell className="text-sm">{e.campaign_id ? e.campaign_id.slice(0, 8) + '...' : '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}