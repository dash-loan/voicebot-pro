import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

const statusLabels = { draft: 'טיוטה', pending_vapi: 'ממתין', active: 'פעיל', paused: 'מושהה', completed: 'הושלם' };
const statusColors = { active: 'default', completed: 'secondary', paused: 'outline', draft: 'outline', pending_vapi: 'outline' };

export default function AllCampaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clientFilter, setClientFilter] = useState('all');

  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ['allCampaigns'], queryFn: () => base44.entities.Campaign.list('-created_date') });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.filter({ role: 'user' }) });
  const { data: callLogs = [] } = useQuery({ queryKey: ['allCallLogs'], queryFn: () => base44.entities.CallLog.list() });

  const toggle = useMutation({
    mutationFn: (campaign) => base44.entities.Campaign.update(campaign.id, {
      status: campaign.status === 'active' ? 'paused' : 'active'
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allCampaigns'] }); toast({ title: 'עודכן' }); }
  });

  const getClientName = (id) => users.find(u => u.id === id)?.full_name || users.find(u => u.id === id)?.email || id?.slice(0, 8) || '-';
  const getCampaignCost = (cid) => {
    const logs = callLogs.filter(l => l.campaign_id === cid);
    const activeMin = Math.ceil(logs.reduce((s, l) => s + (l.active_duration_seconds || l.duration || 0), 0) / 60);
    return (activeMin * 0.063).toFixed(2); // Vapi + Twilio combined
  };

  const filtered = clientFilter === 'all' ? campaigns : campaigns.filter(c => c.client_id === clientFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">כל הקמפיינים</h1>
          <p className="text-muted-foreground mt-1">{campaigns.length} קמפיינים</p>
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="כל הלקוחות" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הלקוחות</SelectItem>
            {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">אין קמפיינים</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>אנשי קשר</TableHead>
                  <TableHead>חויגו</TableHead>
                  <TableHead>ענו</TableHead>
                  <TableHead>עלות אמיתית</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getClientName(c.client_id)}</TableCell>
                    <TableCell><Badge variant={statusColors[c.status]}>{statusLabels[c.status]}</Badge></TableCell>
                    <TableCell>{c.total_contacts || 0}</TableCell>
                    <TableCell>{c.dialed_contacts || 0}</TableCell>
                    <TableCell>{c.answered_contacts || 0}</TableCell>
                    <TableCell className="font-mono text-sm">${getCampaignCost(c.id)}</TableCell>
                    <TableCell>
                      {c.status !== 'completed' && (
                        <Button size="sm" variant="outline" onClick={() => toggle.mutate(c)}>
                          {c.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}