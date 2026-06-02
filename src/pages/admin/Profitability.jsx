import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, Clock, Users, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, getMonth, getYear } from 'date-fns';
import { he } from 'date-fns/locale';

const VAPI_COST_PER_MIN = 0.05;
const TWILIO_COST_PER_MIN = 0.013;
const SELL_PRICE_PER_MIN = 0.25;

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function calcStats(logs, clientMinutes, users, periodStart, periodEnd) {
  return users.map(u => {
    const cm = clientMinutes.find(c => c.client_id === u.id) || { total_minutes: 0, used_minutes: 0 };
    const uLogs = logs.filter(l => l.client_id === u.id && l.created_date &&
      new Date(l.created_date) >= periodStart && new Date(l.created_date) <= periodEnd);
    const activeSeconds = uLogs.reduce((s, l) => s + (l.active_duration_seconds || l.duration || 0), 0);
    const activeMinutes = Math.ceil(activeSeconds / 60);
    const vapiCost = uLogs.reduce((s, l) => s + (l.vapi_cost || 0), 0) || activeMinutes * VAPI_COST_PER_MIN;
    const twilioCost = activeMinutes * TWILIO_COST_PER_MIN;
    const totalCost = vapiCost + twilioCost;
    const revenue = activeMinutes * SELL_PRICE_PER_MIN;
    return {
      id: u.id,
      name: u.full_name || u.email,
      calls: uLogs.length,
      activeMinutes,
      revenue,
      cost: totalCost,
      profit: revenue - totalCost,
      margin: revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0,
    };
  });
}

function StatCard({ label, value, sub, color, icon: Icon, trend }) {
  return (
    <Card className={`border-${color}-200 bg-${color}-50`}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-xs font-semibold text-${color}-600 uppercase tracking-wide`}>{label}</p>
            <p className={`text-3xl font-bold text-${color}-800 mt-1`}>{value}</p>
            {sub && <p className={`text-xs text-${color}-600 mt-1`}>{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl bg-${color}-100 flex items-center justify-center`}>
            <Icon className={`w-5 h-5 text-${color}-600`} />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}% לעומת החודש הקודם
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Profitability() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, 'yyyy-MM'));
  const [compareMonth, setCompareMonth] = useState('none');
  const [clientFilter, setClientFilter] = useState('all');
  const [view, setView] = useState('overview'); // overview | yearly | compare

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.filter({ role: 'user' }) });
  const { data: clientMinutes = [] } = useQuery({ queryKey: ['clientMinutes'], queryFn: () => base44.entities.ClientMinutes.list() });
  const { data: callLogs = [] } = useQuery({ queryKey: ['allCallLogs'], queryFn: () => base44.entities.CallLog.list('-created_date', 2000) });

  const filteredUsers = useMemo(() =>
    clientFilter === 'all' ? users : users.filter(u => u.id === clientFilter),
    [users, clientFilter]
  );

  // Monthly period
  const periodStart = useMemo(() => startOfMonth(new Date(selectedMonth + '-01')), [selectedMonth]);
  const periodEnd = useMemo(() => endOfMonth(new Date(selectedMonth + '-01')), [selectedMonth]);

  const mainStats = useMemo(() => calcStats(callLogs, clientMinutes, filteredUsers, periodStart, periodEnd), [callLogs, clientMinutes, filteredUsers, periodStart, periodEnd]);

  const totalRevenue = mainStats.reduce((s, c) => s + c.revenue, 0);
  const totalCost = mainStats.reduce((s, c) => s + c.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0;
  const totalCalls = mainStats.reduce((s, c) => s + c.calls, 0);

  // Compare period
  const compareStats = useMemo(() => {
    if (compareMonth === 'none') return null;
    const cStart = startOfMonth(new Date(compareMonth + '-01'));
    const cEnd = endOfMonth(new Date(compareMonth + '-01'));
    return calcStats(callLogs, clientMinutes, filteredUsers, cStart, cEnd);
  }, [callLogs, clientMinutes, filteredUsers, compareMonth]);

  const compareTotals = compareStats ? {
    revenue: compareStats.reduce((s, c) => s + c.revenue, 0),
    cost: compareStats.reduce((s, c) => s + c.cost, 0),
    profit: compareStats.reduce((s, c) => s + c.profit, 0),
  } : null;

  const revenueTrend = compareTotals && compareTotals.revenue > 0
    ? ((totalRevenue - compareTotals.revenue) / compareTotals.revenue) * 100 : undefined;

  // Yearly chart data - last 12 months
  const yearlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, 11 - i);
      const mStart = startOfMonth(d);
      const mEnd = endOfMonth(d);
      const stats = calcStats(callLogs, clientMinutes, filteredUsers, mStart, mEnd);
      const rev = stats.reduce((s, c) => s + c.revenue, 0);
      const cost = stats.reduce((s, c) => s + c.cost, 0);
      return {
        month: MONTHS_HE[getMonth(d)],
        הכנסה: +rev.toFixed(2),
        עלות: +cost.toFixed(2),
        רווח: +(rev - cost).toFixed(2),
      };
    });
  }, [callLogs, clientMinutes, filteredUsers]);

  // Month options: Jan 2026 → Dec 2050
  const monthOptions = useMemo(() => {
    const options = [];
    for (let year = 2026; year <= 2050; year++) {
      for (let month = 0; month < 12; month++) {
        const value = `${year}-${String(month + 1).padStart(2, '0')}`;
        options.push({ value, label: `${MONTHS_HE[month]} ${year}` });
      }
    }
    return options;
  }, []);

  const compareOptions = useMemo(() => [
    { value: 'none', label: 'ללא השוואה' },
    ...monthOptions.filter(m => m.value !== selectedMonth)
  ], [monthOptions, selectedMonth]);

  const clientChartData = mainStats.filter(c => c.revenue > 0 || c.cost > 0).map(c => ({
    name: c.name.split(' ')[0],
    הכנסה: +c.revenue.toFixed(2),
    עלות: +c.cost.toFixed(2),
    רווח: +c.profit.toFixed(2),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">רווחיות</h1>
          <p className="text-muted-foreground mt-1">ניתוח פיננסי מלא לפי תקופה ולקוח</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['overview', 'yearly', 'compare'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === v ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
            >
              {v === 'overview' ? '📊 סקירה' : v === 'yearly' ? '📅 שנתי' : '⚖️ השוואה'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {view === 'compare' && (
          <Select value={compareMonth} onValueChange={setCompareMonth}>
            <SelectTrigger className="w-44"><SelectValue placeholder="השוואה ל..." /></SelectTrigger>
            <SelectContent>
              {compareOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="כל הלקוחות" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הלקוחות</SelectItem>
            {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="הכנסות" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} color="green" trend={revenueTrend} sub={`${totalCalls} שיחות`} />
        <StatCard label="עלויות" value={`$${totalCost.toFixed(2)}`} icon={Clock} color="red" sub="Vapi + Twilio" />
        <StatCard label="רווח נקי" value={`$${totalProfit.toFixed(2)}`} icon={TrendingUp} color="blue"
          sub={totalRevenue > 0 ? `מרג'ין ${totalMargin.toFixed(1)}%` : undefined} />
        <StatCard label="לקוחות פעילים" value={mainStats.filter(c => c.calls > 0).length} icon={Users} color="purple" sub={`מתוך ${users.length} סה"כ`} />
      </div>

      {/* Overview View */}
      {view === 'overview' && (
        <div className="space-y-6">
          {clientChartData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>רווחיות לפי לקוח — {monthOptions.find(m => m.value === selectedMonth)?.label}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={clientChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={v => `$${v}`} />
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
                    <TableHead>שיחות</TableHead>
                    <TableHead>דקות פעילות</TableHead>
                    <TableHead>הכנסה</TableHead>
                    <TableHead>עלות</TableHead>
                    <TableHead>רווח</TableHead>
                    <TableHead>מרג'ין</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mainStats.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.calls}</TableCell>
                      <TableCell>{c.activeMinutes}</TableCell>
                      <TableCell className="text-green-600 font-medium">${c.revenue.toFixed(2)}</TableCell>
                      <TableCell className="text-red-600">${c.cost.toFixed(2)}</TableCell>
                      <TableCell className={c.profit >= 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                        ${c.profit.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.margin >= 50 ? 'default' : c.margin >= 20 ? 'secondary' : 'destructive'}>
                          {c.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-bold bg-muted/30">
                    <TableCell>סה"כ</TableCell>
                    <TableCell>{totalCalls}</TableCell>
                    <TableCell>{mainStats.reduce((s, c) => s + c.activeMinutes, 0)}</TableCell>
                    <TableCell className="text-green-600">${totalRevenue.toFixed(2)}</TableCell>
                    <TableCell className="text-red-600">${totalCost.toFixed(2)}</TableCell>
                    <TableCell className={totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}>${totalProfit.toFixed(2)}</TableCell>
                    <TableCell><Badge variant={totalMargin >= 50 ? 'default' : 'secondary'}>{totalMargin.toFixed(1)}%</Badge></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Yearly View */}
      {view === 'yearly' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>הכנסות vs עלויות — 12 חודשים אחרונים</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={yearlyData} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={v => `$${v}`} />
                  <Legend />
                  <Bar dataKey="הכנסה" fill="hsl(150, 50%, 45%)" radius={[4,4,0,0]} />
                  <Bar dataKey="עלות" fill="hsl(0, 70%, 55%)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>רווח נקי לאורך השנה</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={v => `$${v}`} />
                  <ReferenceLine y={0} stroke="hsl(0,70%,55%)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="רווח" stroke="hsl(232, 65%, 40%)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>סיכום שנתי</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>חודש</TableHead>
                    <TableHead>הכנסה</TableHead>
                    <TableHead>עלות</TableHead>
                    <TableHead>רווח</TableHead>
                    <TableHead>מרג'ין</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearlyData.map((row, i) => {
                    const margin = row['הכנסה'] > 0 ? ((row['רווח'] / row['הכנסה']) * 100) : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.month}</TableCell>
                        <TableCell className="text-green-600">${row['הכנסה'].toFixed(2)}</TableCell>
                        <TableCell className="text-red-600">${row['עלות'].toFixed(2)}</TableCell>
                        <TableCell className={row['רווח'] >= 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                          ${row['רווח'].toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={margin >= 50 ? 'default' : margin >= 20 ? 'secondary' : 'destructive'}>
                            {margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-t-2 font-bold bg-muted/30">
                    <TableCell>סה"כ שנתי</TableCell>
                    <TableCell className="text-green-600">${yearlyData.reduce((s, r) => s + r['הכנסה'], 0).toFixed(2)}</TableCell>
                    <TableCell className="text-red-600">${yearlyData.reduce((s, r) => s + r['עלות'], 0).toFixed(2)}</TableCell>
                    <TableCell className="text-green-700 font-bold">${yearlyData.reduce((s, r) => s + r['רווח'], 0).toFixed(2)}</TableCell>
                    <TableCell>—</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Compare View */}
      {view === 'compare' && (
        <div className="space-y-6">
          {compareMonth === 'none' ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">בחר חודש להשוואה מהפילטר למעלה</CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'הכנסות', main: totalRevenue, compare: compareTotals?.revenue, fmt: v => `$${v.toFixed(2)}`, color: 'green' },
                  { label: 'עלויות', main: totalCost, compare: compareTotals?.cost, fmt: v => `$${v.toFixed(2)}`, color: 'red' },
                  { label: 'רווח נקי', main: totalProfit, compare: compareTotals?.profit, fmt: v => `$${v.toFixed(2)}`, color: 'blue' },
                ].map(item => {
                  const diff = item.compare ? ((item.main - item.compare) / Math.abs(item.compare)) * 100 : null;
                  return (
                    <Card key={item.label} className={`border-${item.color}-200 bg-${item.color}-50`}>
                      <CardContent className="pt-5">
                        <p className={`text-xs font-semibold text-${item.color}-600 uppercase`}>{item.label}</p>
                        <div className="flex items-end gap-4 mt-2">
                          <div>
                            <p className="text-xs text-muted-foreground">{monthOptions.find(m => m.value === selectedMonth)?.label}</p>
                            <p className={`text-2xl font-bold text-${item.color}-800`}>{item.fmt(item.main)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{monthOptions.find(m => m.value === compareMonth)?.label}</p>
                            <p className="text-xl font-semibold text-muted-foreground">{item.fmt(item.compare || 0)}</p>
                          </div>
                        </div>
                        {diff !== null && (
                          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {diff >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(diff).toFixed(1)}% שינוי
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardHeader><CardTitle>השוואה ויזואלית — {monthOptions.find(m => m.value === selectedMonth)?.label} vs {monthOptions.find(m => m.value === compareMonth)?.label}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={filteredUsers.map(u => {
                      const main = mainStats.find(c => c.id === u.id);
                      const comp = compareStats?.find(c => c.id === u.id);
                      return {
                        name: (u.full_name || u.email).split(' ')[0],
                        [`רווח (${monthOptions.find(m => m.value === selectedMonth)?.label})`]: +(main?.profit || 0).toFixed(2),
                        [`רווח (${monthOptions.find(m => m.value === compareMonth)?.label})`]: +(comp?.profit || 0).toFixed(2),
                      };
                    })}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={v => `$${v}`} />
                      <Tooltip formatter={v => `$${v}`} />
                      <Legend />
                      <ReferenceLine y={0} stroke="#ccc" />
                      <Bar dataKey={`רווח (${monthOptions.find(m => m.value === selectedMonth)?.label})`} fill="hsl(232, 65%, 40%)" radius={[4,4,0,0]} />
                      <Bar dataKey={`רווח (${monthOptions.find(m => m.value === compareMonth)?.label})`} fill="hsl(51, 100%, 50%)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>פירוט השוואתי לפי לקוח</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>לקוח</TableHead>
                        <TableHead>הכנסה (נוכחי)</TableHead>
                        <TableHead>הכנסה (השוואה)</TableHead>
                        <TableHead>רווח (נוכחי)</TableHead>
                        <TableHead>רווח (השוואה)</TableHead>
                        <TableHead>שינוי</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mainStats.map((c, i) => {
                        const comp = compareStats?.[i];
                        const change = comp && comp.profit !== 0 ? ((c.profit - comp.profit) / Math.abs(comp.profit)) * 100 : null;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-green-600">${c.revenue.toFixed(2)}</TableCell>
                            <TableCell className="text-muted-foreground">${comp?.revenue.toFixed(2) || '0.00'}</TableCell>
                            <TableCell className={c.profit >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>${c.profit.toFixed(2)}</TableCell>
                            <TableCell className="text-muted-foreground">${comp?.profit.toFixed(2) || '0.00'}</TableCell>
                            <TableCell>
                              {change !== null ? (
                                <span className={`flex items-center gap-1 text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  {Math.abs(change).toFixed(1)}%
                                </span>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}