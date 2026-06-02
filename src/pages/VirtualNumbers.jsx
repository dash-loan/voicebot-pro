import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { verifyAndAddNumber } from '@/functions/verifyAndAddNumber';
import { Plus, Phone, Trash2, UserCheck, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
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

export default function VirtualNumbers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [twilioPhoneSid, setTwilioPhoneSid] = useState('');
  const [assignedClientId, setAssignedClientId] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['virtualNumbers'],
    queryFn: () => base44.entities.VirtualNumber.list('-created_date'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.filter({ role: 'user' }),
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

  const handleAdd = async () => {
    if (!twilioPhoneSid.trim().startsWith('PN')) {
      setAddError('ה-SID חייב להתחיל ב-PN (לדוגמה: PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)');
      return;
    }
    setAdding(true);
    setAddError('');
    const resp = await verifyAndAddNumber({ twilioPhoneSid: twilioPhoneSid.trim(), assignedClientId: assignedClientId || null });
    setAdding(false);
    if (resp.data?.success) {
      queryClient.invalidateQueries({ queryKey: ['virtualNumbers'] });
      setDialogOpen(false);
      setTwilioPhoneSid('');
      setAssignedClientId('');
      toast({ title: `✅ המספר ${resp.data.phone_number} נוסף ורשום ב-Vapi` });
    } else {
      setAddError(resp.data?.error || 'שגיאה לא ידועה');
    }
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
        <div className="flex gap-2">
          {/* Step 1: Buy on Twilio */}
          <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/buyaNumber" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="w-4 h-4" /> רכוש מספר ב-Twilio
            </Button>
          </a>
          {/* Step 2: Add to system */}
          <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setTwilioPhoneSid(''); setAssignedClientId(''); setAddError(''); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> הוסף מספר למערכת</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>אימות ורישום מספר Twilio</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-4">
                {/* Workflow steps */}
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                    <div>
                      <p className="text-sm font-medium">רכשת מספר ב-Twilio Console</p>
                      <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/buyaNumber" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1">
                        פתח Twilio Console <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                    <p className="text-sm">העתק את ה-Phone SID מ: Phone Numbers → Manage → Active Numbers → לחץ על המספר</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Twilio Phone SID *</Label>
                  <Input
                    value={twilioPhoneSid}
                    onChange={e => { setTwilioPhoneSid(e.target.value); setAddError(''); }}
                    placeholder="PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    dir="ltr"
                    className={`font-mono ${addError ? 'border-destructive' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">מתחיל תמיד ב-PN ואחריו 32 תווים</p>
                  {addError && (
                    <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {addError}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>שייך ללקוח (אופציונלי)</Label>
                  <Select value={assignedClientId || '_none'} onValueChange={v => setAssignedClientId(v === '_none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="ללא שיוך" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">ללא שיוך</SelectItem>
                      {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 space-y-1">
                  <p className="font-medium">מה קורה בלחיצת "אמת והוסף":</p>
                  <p>✅ בדיקת תקינות מול Twilio API</p>
                  <p>✅ רישום אוטומטי ב-Vapi כ-Phone Number</p>
                  <p>✅ שמירה במערכת ומוכן לשימוש בקמפיינים</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
                <Button onClick={handleAdd} disabled={adding || !twilioPhoneSid.trim()}>
                  {adding ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      מאמת ורושם...
                    </span>
                  ) : '✅ אמת והוסף למערכת'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : numbers.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <Phone className="w-16 h-16 text-muted-foreground/30 mx-auto" />
              <div>
                <p className="text-xl font-medium text-muted-foreground">אין מספרים וירטואליים</p>
                <p className="text-sm text-muted-foreground mt-1">קודם רכוש מספר ב-Twilio, אז הוסף אותו כאן</p>
              </div>
              <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/buyaNumber" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2"><ExternalLink className="w-4 h-4" /> רכוש מספר ב-Twilio</Button>
              </a>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מספר טלפון</TableHead>
                  <TableHead>Vapi ID</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>לקוח משויך</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map(num => (
                  <TableRow key={num.id}>
                    <TableCell className="font-mono font-medium" dir="ltr">{num.phone_number}</TableCell>
                    <TableCell>
                      {num.vapi_phone_number_id ? (
                        <div className="flex items-center gap-1.5 text-green-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="font-mono text-xs">{num.vapi_phone_number_id.slice(0, 14)}...</span>
                        </div>
                      ) : (
                        <span className="text-xs text-yellow-600">לא רשום ב-Vapi</span>
                      )}
                    </TableCell>
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
                          <span className="text-sm font-medium text-primary">{getClientName(num.assigned_client_id)}</span>
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
                            <AlertDialogDescription>האם למחוק את {num.phone_number} מהמערכת? המספר לא יימחק מ-Twilio.</AlertDialogDescription>
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