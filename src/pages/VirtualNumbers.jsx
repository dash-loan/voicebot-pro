import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Phone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

export default function VirtualNumbers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ phone_number: '', provider: 'Twilio', status: 'active' });

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['virtualNumbers'],
    queryFn: () => base44.entities.VirtualNumber.list('-created_date')
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['allCampaigns'],
    queryFn: () => base44.entities.Campaign.list()
  });

  const createNumber = useMutation({
    mutationFn: (data) => base44.entities.VirtualNumber.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualNumbers'] });
      setDialogOpen(false);
      setForm({ phone_number: '', provider: 'Twilio', status: 'active' });
      toast({ title: 'המספר נוסף בהצלחה' });
    }
  });

  const deleteNumber = useMutation({
    mutationFn: (id) => base44.entities.VirtualNumber.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualNumbers'] });
      toast({ title: 'המספר נמחק' });
    }
  });

  const toggleStatus = useMutation({
    mutationFn: async (num) => {
      await base44.entities.VirtualNumber.update(num.id, { status: num.status === 'active' ? 'inactive' : 'active' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualNumbers'] });
    }
  });

  const getCampaignName = (campaignId) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">מספרים וירטואליים</h1>
          <p className="text-muted-foreground mt-1">{numbers.length} מספרים במערכת</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> הוסף מספר</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>הוסף מספר וירטואלי</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>מספר טלפון</Label>
                <Input value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} placeholder="03-1234567" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>ספק</Label>
                <Select value={form.provider} onValueChange={v => setForm({ ...form, provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Twilio">Twilio</SelectItem>
                    <SelectItem value="Vonage">Vonage</SelectItem>
                    <SelectItem value="Other">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
              <Button onClick={() => createNumber.mutate(form)} disabled={!form.phone_number}>הוסף</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : numbers.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">אין מספרים וירטואליים</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מספר טלפון</TableHead>
                  <TableHead>ספק</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>קמפיין מוקצה</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map(num => (
                  <TableRow key={num.id}>
                    <TableCell className="font-mono font-medium" dir="ltr">{num.phone_number}</TableCell>
                    <TableCell>{num.provider}</TableCell>
                    <TableCell>
                      <Badge variant={num.status === 'active' ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggleStatus.mutate(num)}>
                        {num.status === 'active' ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getCampaignName(num.assigned_campaign_id)}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>מחיקת מספר</AlertDialogTitle>
                            <AlertDialogDescription>האם אתה בטוח?</AlertDialogDescription>
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
    </div>
  );
}