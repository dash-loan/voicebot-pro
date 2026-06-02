import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Phone, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

const EMPTY_FORM = { phone_number: '', vapi_phone_number_id: '', provider: 'Twilio', status: 'active', assigned_client_id: '' };

export default function VirtualNumbers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['virtualNumbers'],
    queryFn: () => base44.entities.VirtualNumber.list('-created_date'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.filter({ role: 'user' }),
  });

  const createNumber = useMutation({
    mutationFn: (data) => base44.entities.VirtualNumber.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualNumbers'] });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setErrors({});
      toast({ title: 'המספר נוסף בהצלחה' });
    },
    onError: (e) => toast({ title: 'שגיאה', description: e.message, variant: 'destructive' }),
  });

  const updateNumber = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VirtualNumber.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualNumbers'] });
      setAssignOpen(false);
      setAssignTarget(null);
      toast({ title: 'עודכן בהצלחה' });
    },
  });

  const deleteNumber = useMutation({
    mutationFn: (id) => base44.entities.VirtualNumber.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualNumbers'] });
      toast({ title: 'המספר נמחק' });
    },
  });

  const validate = () => {
    const errs = {};
    if (!form.phone_number.trim()) errs.phone_number = 'שדה חובה';
    if (!form.vapi_phone_number_id.trim()) errs.vapi_phone_number_id = 'שדה חובה – מועתק מ-Vapi Dashboard';
    return errs;
  };

  const handleAdd = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    createNumber.mutate({
      phone_number: form.phone_number.trim(),
      vapi_phone_number_id: form.vapi_phone_number_id.trim(),
      provider: form.provider,
      status: 'active',
      assigned_client_id: form.assigned_client_id || null,
    });
  };

  const getClientName = (id) => {
    if (!id) return null;
    const u = users.find(u => u.id === id);
    return u?.full_name || u?.email || null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">מספרים וירטואליים</h1>
          <p className="text-muted-foreground mt-1">{numbers.length} מספרים · {numbers.filter(n => n.status === 'active').length} פעילים</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setErrors({}); setForm(EMPTY_FORM); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> הוסף מספר</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>הוסף מספר וירטואלי מ-Vapi</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                💡 צור את המספר ב-Vapi Dashboard קודם, ואז הכנס כאן את הפרטים
              </div>
              <div className="space-y-2">
                <Label>מספר טלפון (כפי שמופיע ב-Vapi)</Label>
                <Input
                  value={form.phone_number}
                  onChange={e => { setForm(f => ({ ...f, phone_number: e.target.value })); setErrors(er => ({ ...er, phone_number: '' })); }}
                  placeholder="+972XXXXXXXXX"
                  dir="ltr"
                  className={errors.phone_number ? 'border-destructive' : ''}
                />
                {errors.phone_number && <p className="text-xs text-destructive">{errors.phone_number}</p>}
              </div>
              <div className="space-y-2">
                <Label>Vapi Phone Number ID</Label>
                <Input
                  value={form.vapi_phone_number_id}
                  onChange={e => { setForm(f => ({ ...f, vapi_phone_number_id: e.target.value })); setErrors(er => ({ ...er, vapi_phone_number_id: '' })); }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  dir="ltr"
                  className={`font-mono text-sm ${errors.vapi_phone_number_id ? 'border-destructive' : ''}`}
                />
                {errors.vapi_phone_number_id && <p className="text-xs text-destructive">{errors.vapi_phone_number_id}</p>}
                <p className="text-xs text-muted-foreground">מועתק מ: Vapi Dashboard → Phone Numbers → {'{'}ID{'}'}</p>
              </div>
              <div className="space-y-2">
                <Label>ספק</Label>
                <Select value={form.provider} onValueChange={v => setForm(f => ({ ...f, provider: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Twilio">Twilio</SelectItem>
                    <SelectItem value="Telnyx">Telnyx</SelectItem>
                    <SelectItem value="Vonage">Vonage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>שייך ללקוח (אופציונלי)</Label>
                <Select value={form.assigned_client_id || '_none'} onValueChange={v => setForm(f => ({ ...f, assigned_client_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="ללא שיוך" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">ללא שיוך</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
              <Button onClick={handleAdd} disabled={createNumber.isPending}>
                {createNumber.isPending ? 'מוסיף...' : 'הוסף מספר'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : numbers.length === 0 ? (
            <div className="text-center py-16">
              <Phone className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-medium text-muted-foreground">אין מספרים וירטואליים</p>
              <p className="text-sm text-muted-foreground mt-2">הוסף מספרים שרשמת ב-Vapi Dashboard</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מספר טלפון</TableHead>
                  <TableHead>Vapi ID</TableHead>
                  <TableHead>ספק</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>לקוח משויך</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map(num => (
                  <TableRow key={num.id}>
                    <TableCell className="font-mono font-medium" dir="ltr">{num.phone_number}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {num.vapi_phone_number_id ? num.vapi_phone_number_id.slice(0, 16) + '...' : <span className="text-yellow-600">לא הוגדר</span>}
                    </TableCell>
                    <TableCell className="text-sm">{num.provider || 'Twilio'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={num.status === 'active' ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => updateNumber.mutate({ id: num.id, data: { status: num.status === 'active' ? 'inactive' : 'active' } })}
                      >
                        {num.status === 'active' ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getClientName(num.assigned_client_id) ? (
                          <span className="text-sm text-primary font-medium">{getClientName(num.assigned_client_id)}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">ללא שיוך</span>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setAssignTarget(num); setAssignOpen(true); }}>
                          <UserCheck className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>מחיקת מספר</AlertDialogTitle>
                            <AlertDialogDescription>האם למחוק את {num.phone_number}? פעולה זו לא תסיר את המספר מ-Vapi.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteNumber.mutate(num.id)} className="bg-destructive">מחק</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign client dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>שיוך לקוח – {assignTarget?.phone_number}</DialogTitle></DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">בחר לקוח</Label>
            <Select
              value={assignTarget?.assigned_client_id || '_none'}
              onValueChange={v => setAssignTarget(t => ({ ...t, assigned_client_id: v === '_none' ? '' : v }))}
            >
              <SelectTrigger><SelectValue placeholder="ללא שיוך" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">ללא שיוך</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>ביטול</Button>
            <Button onClick={() => updateNumber.mutate({ id: assignTarget.id, data: { assigned_client_id: assignTarget.assigned_client_id || null } })} disabled={updateNumber.isPending}>
              {updateNumber.isPending ? 'שומר...' : 'שמור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}