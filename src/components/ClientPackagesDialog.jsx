import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Package, Trash2, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const PRESET_PACKAGES = [
  { label: '500 דקות', minutes: 500, price_ils: 350 },
  { label: '1,000 דקות', minutes: 1000, price_ils: 650 },
  { label: '2,000 דקות', minutes: 2000, price_ils: 1200 },
  { label: '5,000 דקות', minutes: 5000, price_ils: 2800 },
];

export default function ClientPackagesDialog({ client, open, onOpenChange }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ package_name: '', minutes: '', price_ils: '' });
  const [showCustom, setShowCustom] = useState(false);

  const { data: packages = [] } = useQuery({
    queryKey: ['clientPackages', client?.id],
    queryFn: () => base44.entities.ClientPackage.filter({ client_id: client.id }, '-created_date'),
    enabled: !!client?.id && open,
  });

  const { data: clientMinutesList = [] } = useQuery({
    queryKey: ['clientMinutes', client?.id],
    queryFn: () => base44.entities.ClientMinutes.filter({ client_id: client.id }),
    enabled: !!client?.id && open,
  });
  const clientMinutes = clientMinutesList[0];

  const addPackage = useMutation({
    mutationFn: async ({ minutes, price_ils, package_name }) => {
      // 1. Save package record
      await base44.entities.ClientPackage.create({
        client_id: client.id,
        package_name: package_name || `${minutes} דקות`,
        minutes,
        price_ils,
        status: 'active',
      });
      // 2. Add minutes to ClientMinutes
      const addMins = Number(minutes);
      if (clientMinutes) {
        const newTotal = (clientMinutes.total_minutes || 0) + addMins;
        const newRemaining = (clientMinutes.remaining_minutes ?? Math.max(0, (clientMinutes.total_minutes || 0) - (clientMinutes.used_minutes || 0))) + addMins;
        await base44.entities.ClientMinutes.update(clientMinutes.id, {
          total_minutes: newTotal,
          remaining_minutes: newRemaining,
          lifetime_minutes: (clientMinutes.lifetime_minutes || 0) + addMins,
        });
      } else {
        await base44.entities.ClientMinutes.create({
          client_id: client.id,
          total_minutes: addMins,
          used_minutes: 0,
          remaining_minutes: addMins,
          lifetime_minutes: addMins,
        });
      }
      // 3. Log transaction
      await base44.entities.MinutesTransaction.create({
        client_id: client.id,
        amount: addMins,
        type: 'add',
        description: `חבילה: ${package_name || `${minutes} דקות`} – ₪${price_ils}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientPackages', client.id] });
      queryClient.invalidateQueries({ queryKey: ['clientMinutes', client.id] });
      queryClient.invalidateQueries({ queryKey: ['clientMinutes'] });
      setForm({ package_name: '', minutes: '', price_ils: '' });
      setShowCustom(false);
      toast({ title: '✅ החבילה נוספה בהצלחה' });
    },
  });

  const deletePackage = useMutation({
    mutationFn: (pkg) => base44.entities.ClientPackage.delete(pkg.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientPackages', client.id] });
      toast({ title: 'החבילה נמחקה' });
    },
  });

  const totalPaid = packages.reduce((s, p) => s + (p.price_ils || 0), 0);
  const totalMinutesBought = packages.reduce((s, p) => s + (p.minutes || 0), 0);
  const usedMinutes = clientMinutes?.used_minutes || 0;

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            חבילות – {client.full_name || client.email}
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-xl p-3 bg-green-50 border-green-200 text-center">
            <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-700">₪{totalPaid.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">שולם סה"כ</p>
          </div>
          <div className="border rounded-xl p-3 bg-blue-50 border-blue-200 text-center">
            <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-700">{totalMinutesBought.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">דקות נרכשו</p>
          </div>
          <div className="border rounded-xl p-3 bg-primary/5 border-primary/20 text-center">
            <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-primary">{Math.round(usedMinutes).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">דקות נוצלו</p>
          </div>
        </div>

        {/* Add package */}
        <div className="border rounded-xl p-4 bg-muted/30 space-y-3">
          <p className="font-semibold text-sm">הוסף חבילה חדשה</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_PACKAGES.map(p => (
              <button
                key={p.minutes}
                onClick={() => addPackage.mutate({ minutes: p.minutes, price_ils: p.price_ils, package_name: p.label })}
                disabled={addPackage.isPending}
                className="border rounded-lg p-3 bg-card hover:bg-primary hover:text-primary-foreground transition-colors text-center group"
              >
                <p className="font-bold text-sm">{p.label}</p>
                <p className="text-xs text-muted-foreground group-hover:text-primary-foreground/80">₪{p.price_ils.toLocaleString()}</p>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="text-xs text-primary hover:underline"
          >
            + חבילה מותאמת אישית
          </button>
          {showCustom && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">שם (אופציונלי)</Label>
                <Input value={form.package_name} onChange={e => setForm({ ...form, package_name: e.target.value })} placeholder="חבילה מיוחדת" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">דקות *</Label>
                <Input type="number" value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} placeholder="1000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מחיר ₪ *</Label>
                <Input type="number" value={form.price_ils} onChange={e => setForm({ ...form, price_ils: e.target.value })} placeholder="650" />
              </div>
              <div className="col-span-3">
                <Button
                  onClick={() => addPackage.mutate({ minutes: Number(form.minutes), price_ils: Number(form.price_ils), package_name: form.package_name })}
                  disabled={!form.minutes || !form.price_ils || addPackage.isPending}
                  size="sm"
                  className="w-full"
                >
                  {addPackage.isPending ? 'מוסיף...' : 'הוסף חבילה'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Package history */}
        <div className="space-y-2">
          <p className="font-semibold text-sm">היסטוריית חבילות ({packages.length})</p>
          {packages.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">אין חבילות עדיין</p>
          ) : (
            <div className="space-y-2">
              {packages.map(pkg => (
                <div key={pkg.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <p className="font-medium text-sm">{pkg.package_name || `${pkg.minutes} דקות`}</p>
                    <p className="text-xs text-muted-foreground">
                      {pkg.minutes?.toLocaleString()} דקות · ₪{pkg.price_ils?.toLocaleString()}
                      {pkg.created_date && ` · ${format(new Date(pkg.created_date), 'dd/MM/yyyy', { locale: he })}`}
                    </p>
                    {pkg.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{pkg.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'}>
                      {pkg.status === 'active' ? 'פעיל' : 'פג תוקף'}
                    </Badge>
                    <button
                      onClick={() => deletePackage.mutate(pkg)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}