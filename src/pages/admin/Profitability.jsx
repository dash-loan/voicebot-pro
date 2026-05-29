import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, DollarSign, Clock, Users } from 'lucide-react';
import { startOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Profitability() {
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.filter({ role: 'user' }) });
  const { data: clientMinutes = [] } = useQuery({ queryKey: ['clientMinutes'], queryFn: () => base44.entities.ClientMinutes.list() });
  const { data: callLogs = [] } = useQuery({ queryKey: ['allCallLogs'], queryFn: () => base44.entities.CallLog.list() });
  const { data: configs = [] } = useQuery({ queryKey: ['vapiConfigs'], queryFn: () => base44.entities.VapiConfig.list() });

  // Cost settings (from VapiConfig or defaults)
  const vapiCostPerMin = 0.05; // $0.05 / min (Vapi default)
  const twilioCostPerMin = 0.013;
  const sellPricePerMin = 0.25; // selling price per minute to clients

  const monthStart = startOfMonth(new Date());
  const monthLogs = callLogs.filter(l => l.created_date && new Date(l.created_date) >= monthStart);

  const clientData = users.map(u => {
    const cm = clientMinutes.find(c => c.client_id === u.id) || { total_minutes: 0, used_minutes: 0 };
    const logs = monthLogs.filter(l => l.client_id === u.id);
    const activeSeconds = logs.reduce((s, l) => s + (l.active_duration_seconds || l.duration || 0), 0);
    const activeMinutes = Math.ceil(activeSeconds / 60);
    const vapiCost = logs.reduce((s, l) => s + (l.vapi_cost || activeMinutes * vapiCostPerMin), 0);
    const twilioCost = activeMinutes * twilioCostPerMin;
    const totalCost = vapiCost + twilioCost;
    const revenue = cm.used_minutes * sellPricePerMin;
    const profit = revenue - totalCost;
    return {
      name: u.full_name || u.email,
      soldMinutes: cm.total_minutes,
      usedMinutes: cm.used_minutes,
      activeMinutes,
      revenue,
      cost: totalCost,
      profit,
    };
  });

  const totalRevenue = clientData.reduce((s, c) => s + c.revenue, 0);
  const totalCost = clientData.reduce((s, c) => s + c.cost, 0);
  const totalProfit = totalRevenue - totalCost;

  const chartData = clientData.filter(c => c.revenue > 0 || c.cost > 0).map(c => ({
    name: c.name.split(' ')[0],
    הכנסה: +c.revenue.toFixed(2),
    עלות: +c.cost.toFixed(2),
    רווח: +c.profit.toFixed(2),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">רווחיות</h1>
        <p className="text-muted-foreground mt-1">נתוני הכנסה ועלות החודש</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-green-700">הכנסות החודש</p>
                <p className="text-3xl font-bold text-green-800">${totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-red-700">עלויות החודש</p>
                <p className="text-3xl font-bold text-red-800">${totalCost.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-primary/70">רווח נקי</p>
                <p className="text-3xl font-bold text-primary">${totalProfit.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>רווחיות לפי לקוח</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => `$${v}`} />
                <Legend />
                <Bar dataKey="הכנסה" fill="hsl(150, 50%, 45%)" radius={[4,4,0,0]} />
                <Bar dataKey="עלות" fill="hsl(0, 70%, 55%)" radius={[4,4,0,0]} />
                <Bar dataKey="רווח" fill="hsl(232, 65%, 40%)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>פירוט לפי לקוח</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>לקוח</TableHead>
                <TableHead>דקות שנמכרו</TableHead>
                <TableHead>דקות שנוצלו</TableHead>
                <TableHead>דקות פעילות</TableHead>
                <TableHead>הכנסה</TableHead>
                <TableHead>עלות (Vapi+Twilio)</TableHead>
                <TableHead>רווח</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientData.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.soldMinutes}</TableCell>
                  <TableCell>{c.usedMinutes}</TableCell>
                  <TableCell>{c.activeMinutes}</TableCell>
                  <TableCell className="text-green-600">${c.revenue.toFixed(2)}</TableCell>
                  <TableCell className="text-red-600">${c.cost.toFixed(2)}</TableCell>
                  <TableCell className={c.profit >= 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                    ${c.profit.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold bg-muted/30">
                <TableCell>סה"כ</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-green-600">${totalRevenue.toFixed(2)}</TableCell>
                <TableCell className="text-red-600">${totalCost.toFixed(2)}</TableCell>
                <TableCell className={totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}>${totalProfit.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}