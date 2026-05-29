import { useState, useRef } from 'react';
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
import { Slider } from '@/components/ui/slider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

export default function Campaigns() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ 
    name: '', script_id: '', virtual_number_id: '', 
    dialing_start: '09:00', dialing_end: '20:00', 
    max_concurrent: 5, max_retries: 2 
  });
  const [contacts, setContacts] = useState([]);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['myCampaigns', user?.id],
    queryFn: () => base44.entities.Campaign.filter({ client_id: user?.id }, '-created_date'),
    enabled: !!user?.id
  });

  const { data: scripts = [] } = useQuery({
    queryKey: ['myScripts', user?.id],
    queryFn: () => base44.entities.Script.filter({ assigned_client_id: user?.id, status: 'active' }),
    enabled: !!user?.id
  });

  const { data: numbers = [] } = useQuery({
    queryKey: ['availableNumbers'],
    queryFn: () => base44.entities.VirtualNumber.filter({ status: 'active' })
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      const campaign = await base44.entities.Campaign.create({
        ...form,
        client_id: user.id,
        status: 'draft',
        total_contacts: contacts.length,
        dialed_contacts: 0,
        answered_contacts: 0
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
      setForm({ name: '', script_id: '', virtual_number_id: '', dialing_start: '09:00', dialing_end: '20:00', max_concurrent: 5, max_retries: 2 });
      setContacts([]);
      toast({ title: 'הקמפיין נוצר בהצלחה' });
      navigate(`/campaigns/${campaign.id}`);
    }
  });

  const toggleCampaign = useMutation({
    mutationFn: async (campaign) => {
      const newStatus = campaign.status === 'active' ? 'paused' : 'active';
      await base44.entities.Campaign.update(campaign.id, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCampaigns'] });
      toast({ title: 'סטטוס הקמפיין עודכן' });
    }
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id) => {
      const campaignContacts = await base44.entities.Contact.filter({ campaign_id: id });
      for (const c of campaignContacts) await base44.entities.Contact.delete(c.id);
      await base44.entities.Campaign.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCampaigns'] });
      toast({ title: 'הקמפיין נמחק' });
    }
  });

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      const lines = text.split('\n').filter(l => l.trim());
      const parsed = lines.slice(1).map(line => {
        const [name, phone] = line.split(',').map(s => s.trim().replace(/"/g, ''));
        return { name: name || 'לא ידוע', phone };
      }).filter(c => c.phone);
      setContacts(parsed);
      toast({ title: `${parsed.length} אנשי קשר נטענו` });
    };
    reader.readAsText(file);
  };

  const statusLabels = { draft: 'טיוטה', active: 'פעיל', paused: 'מושהה', completed: 'הושלם' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">קמפיינים</h1>
          <p className="text-muted-foreground mt-1">{campaigns.length} קמפיינים</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> קמפיין חדש</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>קמפיין חדש - שלב {step}/3</DialogTitle>
              <DialogDescription>{step === 1 ? 'פרטי הקמפיין' : step === 2 ? 'העלאת אנשי קשר' : 'הגדרות חיוג'}</DialogDescription>
            </DialogHeader>
            {step === 1 && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>שם הקמפיין</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="קמפיין מכירות ינואר" />
                </div>
                <div className="space-y-2">
                  <Label>תסריט שיחה</Label>
                  <Select value={form.script_id} onValueChange={v => setForm({ ...form, script_id: v })}>
                    <SelectTrigger><SelectValue placeholder="בחר תסריט" /></SelectTrigger>
                    <SelectContent>
                      {scripts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {scripts.length === 0 && <p className="text-xs text-muted-foreground">אין תסריטים זמינים. פנה למנהל המערכת.</p>}
                </div>
                <div className="space-y-2">
                  <Label>מספר וירטואלי</Label>
                  <Select value={form.virtual_number_id} onValueChange={v => setForm({ ...form, virtual_number_id: v })}>
                    <SelectTrigger><SelectValue placeholder="בחר מספר" /></SelectTrigger>
                    <SelectContent>
                      {numbers.map(n => <SelectItem key={n.id} value={n.id}>{n.phone_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4 py-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">העלה קובץ CSV עם עמודות: שם, טלפון</p>
                  <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>בחר קובץ</Button>
                </div>
                {contacts.length > 0 && (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-medium">{contacts.length} אנשי קשר נטענו</p>
                    <p className="text-sm text-muted-foreground mt-1">דוגמה: {contacts[0]?.name} - {contacts[0]?.phone}</p>
                  </div>
                )}
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>שעת התחלה</Label>
                    <Input type="time" value={form.dialing_start} onChange={e => setForm({ ...form, dialing_start: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>שעת סיום</Label>
                    <Input type="time" value={form.dialing_end} onChange={e => setForm({ ...form, dialing_end: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>שיחות במקביל: {form.max_concurrent}</Label>
                  <Slider value={[form.max_concurrent]} onValueChange={([v]) => setForm({ ...form, max_concurrent: v })} min={1} max={50} step={1} />
                </div>
                <div className="space-y-2">
                  <Label>ניסיונות חוזרים: {form.max_retries}</Label>
                  <Slider value={[form.max_retries]} onValueChange={([v]) => setForm({ ...form, max_retries: v })} min={1} max={3} step={1} />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>הקודם</Button>}
              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)} disabled={step === 1 && (!form.name || !form.script_id)}>הבא</Button>
              ) : (
                <Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending}>{createCampaign.isPending ? 'יוצר...' : 'צור קמפיין'}</Button>
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
                  <TableHead>אנשי קשר</TableHead>
                  <TableHead>חויגו</TableHead>
                  <TableHead>ענו</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map(campaign => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      <Badge variant={campaign.status === 'active' ? 'default' : campaign.status === 'completed' ? 'secondary' : 'outline'}>
                        {statusLabels[campaign.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{campaign.total_contacts || 0}</TableCell>
                    <TableCell>{campaign.dialed_contacts || 0}</TableCell>
                    <TableCell>{campaign.answered_contacts || 0}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}