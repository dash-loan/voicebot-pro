import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Users, Clock, PhoneCall, TrendingUp, ArrowLeft, FileText, Mic, Phone, DollarSign, Flame, BarChart2, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const QUALITY_COLORS = {
  hot_lead: '#ef4444',
  warm_lead: '#f97316',
  qualified: '#22c55e',
  not_interested: '#94a3b8',
  unqualified: '#cbd5e1',
};

const QUALITY_LABELS = {
  hot_lead: 'ליד חם 🔥',
  warm_lead: 'ליד חמים',
  qualified: 'מוסמך',
  not_interested: 'לא מעוניין',
  unqualified: 'לא מוסמך',
};

export default function AdminDashboard() {
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.filter({ role: 'user' }) });
  const { data: clientMinutes = [] } = useQuery({ queryKey: ['clientMinutes'], queryFn: () => base44.entities.ClientMinutes.list() });
  const { data: campaigns = [] } = useQuery({ queryKey: ['allCampaigns'], queryFn: () => base44.entities.Campaign.list() });
  const { data: scripts = [] } = useQuery({ queryKey: ['scripts'], queryFn: () => base44.entities.Script.list() });
  const { data: callLogs = [] } = useQuery({ queryKey: ['allCallLogs'], queryFn: () => base44.entities.CallLog.list() });
  const { data: vapiConfigs = [] } = useQuery({ queryKey: ['vapiConfigs'], queryFn: () => base44.entities.VapiConfig.list() });
  const { data: numbers = [] } = useQuery({ queryKey: ['virtualNumbers'], queryFn: () => base44.entities.VirtualNumber.list() });

  const vapiConfig = vapiConfigs[0] || {};
  const sellPriceILS = vapiConfig.sell_price_per_minute_ils || 0.7;
  const USD_TO_ILS = 3.7;

  // KPIs
  const now = new Date();
  const thisMonthLogs = callLogs.filter(l => {
    const d = new Date(l.created_date || 0);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthMinutes = thisMonthLogs.reduce((s, l) => s + (l.active_duration_seconds || 0), 0) / 60;
  const revenueILS = monthMinutes * sellPriceILS;
  const costUSD = thisMonthLogs.reduce((s, l) => s + (l.vapi_cost || 0), 0);
  const costILS = costUSD * USD_TO_ILS;
  const profitILS = revenueILS - costILS;
  const profitPct = revenueILS > 0 ? Math.round((profitILS / revenueILS) * 100) : 0;
  const hotLeads = callLogs.filter(l => l.lead_quality === 'hot_lead').length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  // Monthly chart data (last 6 months)
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLogs = callLogs.filter(l => {
      const ld = new Date(l.created_date || 0);
      return ld.getMonth() === d.getMonth() && ld.getFullYear() === d.getFullYear();
    });
    const mMins = monthLogs.reduce((s, l) => s + (l.active_duration_seconds || 0), 0) / 60;
    const mRev = Math.round(mMins * sellPriceILS);
    const mCost = Math.round(monthLogs.reduce((s, l) => s + (l.vapi_cost || 0), 0) * USD_TO_ILS);
    monthlyData.push({
      name: format(d, 'MMM', { locale: he }),
      'הכנסות ₪': mRev,
      'עלויות ₪': mCost,
    });
  }

  // Lead quality pie
  const qualityCounts = {};
  callLogs.forEach(l => {
    const q = l.lead_quality || 'unqualified';
    qualityCounts[q] = (qualityCounts[q] || 0) + 1;
  });
  const pieData = Object.entries(qualityCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: QUALITY_LABELS[k] || k, value: v, key: k }));

  // Client profitability
  const clientProfit = users.map(u => {
    const logs = callLogs.filter(l => l.client_id === u.id);
    const mins = logs.reduce((s, l) => s + (l.active_duration_seconds || 0), 0) / 60;
    const rev = mins * sellPriceILS;
    const cost = logs.reduce((s, l) => s + (l.vapi_cost || 0), 0) * USD_TO_ILS;
    const hot = logs.filter(l => l.lead_quality === 'hot_lead').length;
    return { ...u, rev: Math.round(rev), cost: Math.round(cost), profit: Math.round(rev - cost), hotLeads: hot, totalCalls: logs.length };
  }).sort((a, b) => b.profit - a.profit);

  const kpis = [
    { label: 'הכנסות החודש', value: `₪${Math.round(revenueILS).toLocaleString()}`, sub: `${Math.round(monthMinutes)} דקות`, color: 'text-blue-900', bg: 'bg-blue-50 border-blue-200', icon: DollarSign },
    { label: 'עלויות החודש', value: `₪${Math.round(costILS).toLocaleString()}`, sub: `$${costUSD.toFixed(2)} USD`, color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: BarChart2 },
    { label: 'רווח נקי', value: `₪${Math.round(profitILS).toLocaleString()}`, sub: `${profitPct}% רווחיות`, color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: TrendingUp },
    { label: 'סה"כ שיחות', value: callLogs.length.toLocaleString(), sub: `${activeCampaigns} קמפיינים פעילים`, color: 'text-primary', bg: 'bg-primary/5 border-primary/20', icon: PhoneCall },
    { label: 'לידים חמים 🔥', value: hotLeads.toLocaleString(), sub: `${callLogs.length > 0 ? Math.round((hotLeads / callLogs.length) * 100) : 0}% מהשיחות`, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: Flame },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">דשבורד ניהול</h1>
          <p className="text-muted-foreground mt-1">סקירה כללית · {format(now, 'MMMM yyyy', { locale: he })}</p>
        </div>
        <Link to="/admin/settings">
          <Button variant="outline" size="sm" className="gap-2"><Settings className="w-4 h-4" /> הגדרות</Button>
        </Link>
      </div>

      {/* Setup checklist */}
      {(!vapiConfig.is_connected || numbers.length === 0 || scripts.length === 0) && (
        <div className="bg-gradient-to-l from-primary/5 to-transparent border border-primary/20 rounded-xl p-5">
          <h2 className="font-bold mb-3">🚀 השלם הגדרת המערכת</h2>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'חבר Vapi', done: vapiConfig.is_connected, link: '/admin/settings' },
              { label: 'מספר וירטואלי', done: numbers.length > 0, link: '/admin/numbers' },
              { label: 'תסריט ראשון', done: scripts.length > 0, link: '/admin/scripts' },
              { label: 'לקוח ראשון', done: users.length > 0, link: '/admin/clients' },
            ].map((s, i) => (
              s.done ? (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <span>✅</span> {s.label}
                </div>
              ) : (
                <Link key={i} to={s.link}>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-card border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                    <span>⬜</span> {s.label}
                  </div>
                </Link>
              )
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`border rounded-xl p-5 ${kpi.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>הכנסות מול עלויות (₪)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `₪${v}`} />
                <Legend />
                <Bar dataKey="הכנסות ₪" fill="#1a237e" radius={[4,4,0,0]} />
                <Bar dataKey="עלויות ₪" fill="#ffd700" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>איכות לידים</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">אין נתונים עדיין</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={QUALITY_COLORS[entry.key] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client Profitability Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>רווחיות לפי לקוח</CardTitle>
          <Link to="/admin/clients"><Button variant="ghost" size="sm" className="gap-2">כל הלקוחות <ArrowLeft className="w-4 h-4" /></Button></Link>
        </CardHeader>
        <CardContent>
          {clientProfit.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">אין לקוחות עדיין</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-right py-2 font-medium">לקוח</th>
                    <th className="text-right py-2 font-medium">שיחות</th>
                    <th className="text-right py-2 font-medium">לידים חמים</th>
                    <th className="text-right py-2 font-medium">הכנסה ₪</th>
                    <th className="text-right py-2 font-medium">עלות ₪</th>
                    <th className="text-right py-2 font-medium">רווח ₪</th>
                    <th className="text-right py-2 font-medium">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {clientProfit.slice(0, 10).map(c => (
                    <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3">
                        <p className="font-medium">{c.full_name || c.email}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="py-3">{c.totalCalls}</td>
                      <td className="py-3">
                        <span className="font-bold text-orange-600">{c.hotLeads}</span>
                        {c.hotLeads > 0 && <span className="text-orange-500 mr-1">🔥</span>}
                      </td>
                      <td className="py-3 font-medium text-green-700">₪{c.rev.toLocaleString()}</td>
                      <td className="py-3 text-red-600">₪{c.cost.toLocaleString()}</td>
                      <td className="py-3 font-bold text-primary">₪{c.profit.toLocaleString()}</td>
                      <td className="py-3">
                        <Badge variant={c.status === 'active' ? 'default' : 'destructive'}>{c.status === 'active' ? 'פעיל' : 'חסום'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { to: '/admin/clients', icon: Users, label: 'לקוחות' },
          { to: '/admin/campaigns', icon: PhoneCall, label: 'קמפיינים' },
          { to: '/admin/scripts', icon: FileText, label: 'תסריטים' },
          { to: '/admin/tts', icon: Mic, label: 'בונה קול' },
          { to: '/admin/numbers', icon: Phone, label: 'מספרים' },
          { to: '/admin/profitability', icon: TrendingUp, label: 'רווחיות' },
        ].map(a => (
          <Link key={a.to} to={a.to}>
            <div className="border rounded-xl p-4 bg-card hover:bg-muted/50 transition-colors text-center cursor-pointer">
              <a.icon className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">{a.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}