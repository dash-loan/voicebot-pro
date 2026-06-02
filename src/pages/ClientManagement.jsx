import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Lock, Unlock, CreditCard, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function ClientManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [minutesToAdd, setMinutesToAdd] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.filter({ role: 'user' })
  });

  const { data: clientMinutes = [] } = useQuery({
    queryKey: ['clientMinutes'],
    queryFn: () => base44.entities.ClientMinutes.list()
  });

  const { data: callLogs = [] } = useQuery({
    queryKey: ['allCallLogs'],
    queryFn: () => base44.entities.CallLog.list()
  });

  const toggleStatus = useMutation({
    mutationFn: async (user) => {
      const newStatus = user.status === 'active' ? 'blocked' : 'active';
      await base44.entities.User.update(user.id, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'הסטטוס עודכן בהצלחה' });
    }
  });

  const inviteClient = useMutation({
    mutationFn: async (email) => {
      await base44.users.inviteUser(email, 'user');
    },
    onSuccess: () => {
      setInviteOpen(false);
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'ההזמנה נשלחה בהצלחה' });
    },
    onError: (err) => {
      toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
    }
  });

  const addMinutes = useMutation({
    mutationFn: async ({ clientId, amount }) => {
      const existing = clientMinutes.find(cm => cm.client_id === clientId);
      if (existing) {
        await base44.entities.ClientMinutes.update(existing.id, {
          total_minutes: (existing.total_minutes || 0) + amount
        });
      } else {
        await base44.entities.ClientMinutes.create({
          client_id: clientId,
          total_minutes: amount,
          used_minutes: 0
        });
      }
      await base44.entities.MinutesTransaction.create({
        client_id: clientId,
        amount,
        type: 'add',
        description: 'הוספת דקות ע״י מנהל'
      });
    },
    onSuccess: () => {
      setMinutesOpen(false);
      setMinutesToAdd('');
      setSelectedClient(null);
      queryClient.invalidateQueries({ queryKey: ['clientMinutes'] });
      toast({ title: 'הדקות נוספו בהצלחה' });
    }
  });

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getClientStats = (clientId) => {
    const cm = clientMinutes.find(c => c.client_id === clientId);
    const logs = callLogs.filter(l => l.client_id === clientId);
    const monthLogs = logs.filter(l => {
      const d = new Date(l.created_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthMinutes = Math.round(monthLogs.reduce((s, l) => s + (l.duration || 0), 0) / 60);
    const totalMinutes = Math.round(logs.reduce((s, l) => s + (l.duration || 0), 0) / 60);
    return {
      remaining: (cm?.total_minutes || 0) - (cm?.used_minutes || 0),
      monthUsed: monthMinutes,
      totalUsed: totalMinutes
    };
  };

  const activeUsers = users.filter(u => u.status !== 'blocked').length;
  const noMinutesUsers = users.filter(u => {
    const cm = clientMinutes.find(c => c.client_id === u.id);
    return !cm || (cm.total_minutes - cm.used_minutes) <= 0;
  }).length;
  const totalMinutesRemaining = clientMinutes.reduce((s, cm) => s + Math.max(0, (cm.total_minutes || 0) - (cm.used_minutes || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">ניהול לקוחות</h1>
          <p className="text-muted-foreground mt-1">{users.length} לקוחות במערכת</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> הזמן לקוח חדש</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>הזמן לקוח חדש</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>אימייל</Label>
                <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="client@example.com" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>ביטול</Button>
              <Button onClick={() => inviteClient.mutate(inviteEmail)} disabled={!inviteEmail || inviteClient.isPending}>
                {inviteClient.isPending ? 'שולח...' : 'שלח הזמנה'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 bg-card">
          <p className="text-sm text-muted-foreground">סה"כ לקוחות</p>
          <p className="text-3xl font-bold text-primary">{users.length}</p>
        </div>
        <div className="border rounded-xl p-4 bg-green-50 border-green-200">
          <p className="text-sm text-muted-foreground">פעילים</p>
          <p className="text-3xl font-bold text-green-700">{activeUsers}</p>
        </div>
        <div className="border rounded-xl p-4 bg-red-50 border-red-200">
          <p className="text-sm text-muted-foreground">ללא דקות</p>
          <p className="text-3xl font-bold text-red-600">{noMinutesUsers}</p>
        </div>
        <div className="border rounded-xl p-4 bg-blue-50 border-blue-200">
          <p className="text-sm text-muted-foreground">דקות נותרות (כולל)</p>
          <p className="text-3xl font-bold text-blue-700">{Math.round(totalMinutesRemaining).toLocaleString()}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="חיפוש לפי שם, אימייל או חברה..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">לא נמצאו לקוחות</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>לקוח</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>דקות נותרו</TableHead>
                  <TableHead>החודש</TableHead>
                  <TableHead>סה״כ</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => {
                  const stats = getClientStats(user.id);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'לא צוין'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          {user.company_name && <p className="text-xs text-muted-foreground">{user.company_name}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                          {user.status === 'active' ? 'פעיל' : 'חסום'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{stats.remaining}</TableCell>
                      <TableCell>{stats.monthUsed}</TableCell>
                      <TableCell>{stats.totalUsed}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => toggleStatus.mutate(user)}>
                            {user.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedClient(user); setMinutesOpen(true); }}>
                            <CreditCard className="w-4 h-4" />
                          </Button>
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

      <Dialog open={minutesOpen} onOpenChange={setMinutesOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>הוספת דקות - {selectedClient?.full_name || selectedClient?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>כמות דקות להוספה</Label>
              <Input type="number" value={minutesToAdd} onChange={e => setMinutesToAdd(e.target.value)} placeholder="500" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMinutesOpen(false)}>ביטול</Button>
            <Button onClick={() => addMinutes.mutate({ clientId: selectedClient.id, amount: parseInt(minutesToAdd) })} disabled={!minutesToAdd || addMinutes.isPending}>
              {addMinutes.isPending ? 'מוסיף...' : 'הוסף דקות'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}