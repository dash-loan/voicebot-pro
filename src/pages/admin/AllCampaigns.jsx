import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, Megaphone, Eye, Flame } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';

const STATUS = {
  draft:       { label: 'טיוטה',   variant: 'outline' },
  pending_vapi:{ label: 'ממתין',   variant: 'outline' },
  active:      { label: 'פעיל',    variant: 'default' },
  paused:      { label: 'עצור',    variant: 'secondary' },
  completed:   { label: 'הושלם',   variant: 'secondary' },
};

export default function AllCampaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clientFilter, setClientFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['allCampaigns'],
    queryFn: () => base44.entities.Campaign.list('-created_date'),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.filter({ role: 'user' }),
  });
  const { data: callLogs = [] } = useQuery({
    queryKey: ['allCallLogs'],
    queryFn: () => base44.entities.CallLog.list('-created_date', 500),
    staleTime: 60000,
  });

  // Pre-index hot leads by campaign — O(n) once instead of O(n) per row
  const hotLeadsByCampaign = useMemo(() => {
    const map = {};
    callLogs.forEach(l => {
      if (l.lead_quality === 'hot_lead') {
        map[l.campaign_id] = (map[l.campaign_id] || 0) + 1;
      }
    });
    return map;
  }, [callLogs]);

  const toggle = useMutation({
    mutationFn: (c) => base44.entities.Campaign.update(c.id, {
      status: c.status === 'active' ? 'paused' : 'active',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allCampaigns'] });
      toast({ title: 'סטטוס קמפיין עודכן' });
    },
  });

  const userMap = useMemo(() =>
    Object.fromEntries(users.map(u => [u.id, u.full_name || u.email])),
    [users]
  );

  const getClientName = (id) => userMap[id] || '—';

  const filtered = campaigns
    .filter(c => clientFilter === 'all' || c.client_id === clientFilter)
    .filter(c => statusFilter === 'all' || c.status === statusFilter);

  const activeCount = campaigns.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">כל הקמפיינים</h1>
          <p className="text-muted-foreground mt-1">{campaigns.length} קמפיינים · {activeCount} פעילים</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="כל הסטטוסים" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="כל הלקוחות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הלקוחות</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Megaphone className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-medium text-muted-foreground">אין קמפיינים</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>התקדמות</TableHead>
                  <TableHead>לידים חמים</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const progress = c.total_contacts > 0 ? Math.round((c.dialed_contacts / c.total_contacts) * 100) : 0;
                  const hotLeads = hotLeadsByCampaign[c.id] || 0;
                  const s = STATUS[c.status] || STATUS.draft;
                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{getClientName(c.client_id)}</TableCell>
                      <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{c.dialed_contacts || 0} / {c.total_contacts || 0}</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {hotLeads > 0 ? (
                          <span className="flex items-center gap-1 text-orange-600 font-semibold">
                            <Flame className="w-4 h-4" /> {hotLeads}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link to={`/campaigns/${c.id}`}>
                            <Button size="sm" variant="outline"><Eye className="w-4 h-4" /></Button>
                          </Link>
                          {c.status !== 'completed' && (
                            <Button size="sm" variant="outline" onClick={() => toggle.mutate(c)} disabled={toggle.isPending}>
                              {c.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
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