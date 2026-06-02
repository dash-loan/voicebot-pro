import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Megaphone, Play, Pause, Eye, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import { validateIsraeliMobile } from '@/utils/phoneUtils';

const statusLabels = { draft: 'טיוטה', pending_vapi: 'בהכנה', active: 'פעיל', paused: 'עצור', completed: 'הושלם' };
const statusColors = { active: 'default', completed: 'secondary', paused: 'outline', draft: 'outline', pending_vapi: 'outline' };

export default function Campaigns() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(1);
  const scriptFromUrl = new URLSearchParams(window.location.search).get('script') || '';
  const [form, setForm] = useState({ name: '', script_id: scriptFromUrl, virtual_number_id: '', start_date: '', dialing_start: '09:00', dialing_end: '20:00', max_concurrent: 5, max_retries: 2 });

  useEffect(() => {
    if (scriptFromUrl) setDialogOpen(true);
  }, []);  // eslint-disable-line
  const [contacts, setContacts] = useState([]);
  const [uploadPreview, setUploadPreview] = useState(null); // { valid, invalid, duplicates }

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const isAdmin = user?.role === 'admin';
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['myCampaigns', user?.id, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.Campaign.list('-created_date')
      : base44.entities.Campaign.filter({ client_id: user?.id }, '-created_date'),
    enabled: !!user,
  });

  const { data: scripts = [] } = useQuery({
    queryKey: ['myScripts', user?.id, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.Script.filter({ status: 'active' })
      : base44.entities.Script.filter({ assigned_client_id: user?.id, status: 'active' }),
    enabled: !!user,
  });

  const { data: virtualNumbers = [] } = useQuery({
    queryKey: ['virtualNumbers'],
    queryFn: () => base44.entities.VirtualNumber.filter({ status: 'active' }),
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      const selectedScript = scripts.find(s => s.id === form.script_id);
      const clientId = isAdmin && form.target_client_id ? form.target_client_id : user.id;
      const campaign = await base44.entities.Campaign.create({
        name: form.name,
        script_id: form.script_id,
        virtual_number_id: form.virtual_number_id,
        start_date: form.start_date,
        dialing_start: form.dialing_start,
        dialing_end: form.dialing_end,
        max_concurrent: form.max_concurrent,
        max_retries: form.max_retries,
        client_id: clientId,
        status: 'draft',
        total_contacts: contacts.length,
        dialed_contacts: 0,
        answered_contacts: 0,
        vapi_assistant_id: selectedScript?.vapi_assistant_id || '',
      });
      if (contacts.length > 0) {
        await base44.entities.Contact.bulkCreate(
          contacts.map(c => ({ campaign_id: campaign.id, name: c.name, phone: c.phone, status: 'pending', attempts: 0 }))
        );
      }
      return campaign;
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['myCampaigns'] });
      setDialogOpen(false);
      setStep(1);
      setForm({ name: '', script_id: '', dialing_start: '09:00', dialing_end: '20:00', max_concurrent: 5, max_retries: 2 });
      setContacts([]);
      toast({ title: 'הקמפיין נוצר בהצלחה' });
      navigate(`/campaigns/${campaign.id}`);
    }
  });

  const toggleCampaign = useMutation({
    mutationFn: (campaign) => base44.entities.Campaign.update(campaign.id, {
      status: campaign.status === 'active' ? 'paused' : 'active'
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['myCampaigns'] }); toast({ title: 'סטטוס עודכן' }); }
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id) => {
      const campaignContacts = await base44.entities.Contact.filter({ campaign_id: id });
      for (const c of campaignContacts) await base44.entities.Contact.delete(c.id);
      await base44.entities.Campaign.delete(id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['myCampaigns'] }); toast({ title: 'הקמפיין נמחק' }); }
  });



  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const hasHeader = /שם|name|phone|טלפון/i.test(lines[0]);
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const seen = new Set();
      const valid = [];
      const rejected = [];

      for (const line of dataLines) {
        const parts = line.split(',').map(s => s.trim().replace(/"/g, ''));
        const name = parts[0] || 'לא ידוע';
        const rawPhone = parts[1] || parts[0];
        if (!rawPhone) continue;
        const result = validateIsraeliMobile(rawPhone);
        if (!result.valid) { rejected.push({ name, phone: rawPhone, reason: result.reason }); continue; }
        if (seen.has(result.normalized)) { rejected.push({ name, phone: rawPhone, reason: 'כפיל - כבר קיים ברשימה' }); continue; }
        seen.add(result.normalized);
        valid.push({ name, phone: result.normalized });
      }

      setUploadPreview({ valid: valid.length, rejected });
      setContacts(valid);
      if (valid.length > 0) toast({ title: `✅ ${valid.length} מספרים תקינים יובאו` });
      else toast({ title: 'לא נמצאו מספרים תקינים', variant: 'destructive' });
    };
    reader.readAsText(file);
  };

  const activeCount = campaigns.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">קמפיינים</h1>
          <p className="text-muted-foreground mt-1">{campaigns.length} קמפיינים · {activeCount} פעילים</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> קמפיין חדש</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>קמפיין חדש – שלב {step}/2</DialogTitle>
              <DialogDescription>{step === 1 ? 'פרטי הקמפיין' : 'העלאת רשימת לקוחות'}</DialogDescription>
            </DialogHeader>

            {step === 1 && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>שם הקמפיין *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="קמפיין מכירות ינואר" />
                </div>
                <div className="space-y-2">
                  <Label>תסריט שיחה *</Label>
                  <Select value={form.script_id} onValueChange={v => setForm({ ...form, script_id: v })}>
                    <SelectTrigger><SelectValue placeholder="בחר תסריט" /></SelectTrigger>
                    <SelectContent>
                      {scripts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {scripts.length === 0 && <p className="text-xs text-muted-foreground">אין תסריטים פעילים. פנה למנהל המערכת.</p>}
                </div>
                <div className="space-y-2">
                  <Label>מספר טלפון יוצא *</Label>
                  <Select value={form.virtual_number_id} onValueChange={v => setForm({ ...form, virtual_number_id: v })}>
                    <SelectTrigger><SelectValue placeholder="בחר מספר" /></SelectTrigger>
                    <SelectContent>
                      {virtualNumbers.map(n => <SelectItem key={n.id} value={n.id}>{n.phone_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {virtualNumbers.length === 0 && <p className="text-xs text-muted-foreground">אין מספרים פעילים. פנה למנהל המערכת.</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>תאריך התחלה *</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} min={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div className="space-y-2">
                    <Label>שעת התחלה</Label>
                    <Input type="time" value={form.dialing_start} onChange={e => setForm({ ...form, dialing_start: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 py-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2 font-medium">העלה קובץ CSV / Excel</p>
                  <p className="text-sm text-muted-foreground mb-4">עמודות: שם, טלפון</p>
                  <input type="file" accept=".csv,.xlsx" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>בחר קובץ</Button>
                </div>
                {uploadPreview && (
                  <div className="space-y-2 text-sm">
                    <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700 font-medium">
                      ✅ {uploadPreview.valid} מספרים תקינים יובאו
                    </div>
                    {uploadPreview.rejected.length > 0 && (
                      <div className="border border-red-200 rounded overflow-hidden">
                        <div className="p-2 bg-red-50 text-red-700 font-medium">❌ {uploadPreview.rejected.length} נדחו:</div>
                        <div className="max-h-32 overflow-y-auto">
                          {uploadPreview.rejected.map((r, i) => (
                            <div key={i} className="px-3 py-1.5 text-xs border-t border-red-100 flex justify-between">
                              <span className="text-muted-foreground" dir="ltr">{r.phone}</span>
                              <span className="text-red-600">{r.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {contacts.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">ניתן להמשיך ללא רשימה ולהוסיף אנשי קשר מאוחר יותר</p>
                )}
              </div>
            )}



            <DialogFooter className="gap-2">
              {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>הקודם</Button>}
              {step < 2 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!form.name || !form.script_id || !form.start_date}>הבא</Button>
              ) : (
                <Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending}>
                  {createCampaign.isPending ? 'יוצר...' : '🚀 צור קמפיין'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">אין קמפיינים עדיין</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>צור קמפיין ראשון</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>התקדמות</TableHead>
                  <TableHead>ענו</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map(campaign => {
                  const progress = campaign.total_contacts > 0 ? Math.round((campaign.dialed_contacts / campaign.total_contacts) * 100) : 0;
                  return (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">{campaign.dialing_start} – {campaign.dialing_end}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[campaign.status]}>{statusLabels[campaign.status]}</Badge>
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{campaign.dialed_contacts || 0} / {campaign.total_contacts || 0}</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{campaign.answered_contacts || 0}</span>
                      <span className="text-xs text-muted-foreground"> / {campaign.total_contacts || 0}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/campaigns/${campaign.id}`)}><Eye className="w-4 h-4" /></Button>
                        {campaign.status !== 'completed' && (
                          <Button size="sm" variant="outline" onClick={() => toggleCampaign.mutate(campaign)}>
                            {campaign.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>מחיקת קמפיין</AlertDialogTitle>
                              <AlertDialogDescription>האם אתה בטוח?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCampaign.mutate(campaign.id)} className="bg-destructive">מחק</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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