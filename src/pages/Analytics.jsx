import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { he } from 'date-fns/locale';
import StatsCard from '@/components/StatsCard';
import { PhoneCall, Clock, UserCheck, TrendingUp } from 'lucide-react';

const COLORS = ['hsl(232, 65%, 40%)', 'hsl(51, 100%, 50%)', 'hsl(200, 60%, 50%)', 'hsl(150, 50%, 45%)', 'hsl(0, 70%, 55%)'];

export default function Analytics() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: callLogs = [] } = useQuery({
    queryKey: ['myCallLogs', user?.id],
    queryFn: () => base44.entities.CallLog.filter({ client_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['myCampaigns', user?.id],
    queryFn: () => base44.entities.Campaign.filter({ client_id: user?.id }),
    enabled: !!user?.id
  });

  // Stats
  const totalCalls = callLogs.length;
  const answeredCalls = callLogs.filter(l => ['answered', 'interested', 'not_interested'].includes(l.status)).length;
  const interestedCalls = callLogs.filter(l => l.status === 'interested').length;
  const avgDuration = callLogs.length > 0
    ? Math.round(callLogs.reduce((sum, l) => sum + (l.duration || 0), 0) / callLogs.filter(l => l.duration > 0).length || 1)
    : 0;

  // Daily answer rate for last 14 days
  const dailyData = [];
  for (let i = 13; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayLogs = callLogs.filter(l => l.created_date && format(new Date(l.created_date), 'yyyy-MM-dd') === dateStr);
    const dayAnswered = dayLogs.filter(l => ['answered', 'interested', 'not_interested'].includes(l.status)).length;
    dailyData.push({
      date: format(date, 'dd/MM', { locale: he }),
      total: dayLogs.length,
      answered: dayAnswered,
      rate: dayLogs.length > 0 ? Math.round((dayAnswered / dayLogs.length) * 100) : 0
    });
  }

  // Campaign comparison
  const campaignData = campaigns.map(c => {
    const logs = callLogs.filter(l => l.campaign_id === c.id);
    const interested = logs.filter(l => l.status === 'interested').length;
    const answered = logs.filter(l => ['answered', 'interested', 'not_interested'].includes(l.status)).length;
    return {
      name: c.name?.substring(0, 15) || 'N/A',
      interested,
      answered,
      total: logs.length,
      rate: logs.length > 0 ? Math.round((interested / logs.length) * 100) : 0
    };
  });

  // Status distribution
  const statusData = [
    { name: 'מעוניין', value: callLogs.filter(l => l.status === 'interested').length },
    { name: 'לא מעוניין', value: callLogs.filter(l => l.status === 'not_interested').length },
    { name: 'ענה', value: callLogs.filter(l => l.status === 'answered').length },
    { name: 'לא ענה', value: callLogs.filter(l => l.status === 'no_answer').length },
    { name: 'תא קולי', value: callLogs.filter(l => l.status === 'voicemail').length },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">אנליטיקה</h1>
        <p className="text-muted-foreground mt-1">סטטיסטיקות ותובנות</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="סה״כ שיחות" value={totalCalls} icon={PhoneCall} />
        <StatsCard title="אחוז מענה" value={totalCalls > 0 ? `${Math.round((answeredCalls / totalCalls) * 100)}%` : '0%'} icon={UserCheck} color="gold" />
        <StatsCard title="מעוניינים" value={interestedCalls} icon={TrendingUp} />
        <StatsCard title="משך ממוצע" value={`${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, '0')}`} subtitle="דקות" icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>אחוז מענה לפי יום</CardTitle></CardHeader>
          <CardContent>
            {callLogs.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">אין מספיק נתונים להצגת גרפים. הפעל קמפיין כדי לראות תובנות.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip contentStyle={{ direction: 'rtl', textAlign: 'right' }} />
                  <Legend />
                  <Area type="monotone" dataKey="total" name="סה״כ" fill="hsl(232, 65%, 40%)" fillOpacity={0.2} stroke="hsl(232, 65%, 40%)" />
                  <Area type="monotone" dataKey="answered" name="ענו" fill="hsl(51, 100%, 50%)" fillOpacity={0.3} stroke="hsl(51, 100%, 50%)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>התפלגות סטטוסים</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">אין נתונים עדיין</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>השוואה בין קמפיינים</CardTitle></CardHeader>
        <CardContent>
          {campaignData.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">אין קמפיינים עדיין</p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={campaignData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip contentStyle={{ direction: 'rtl', textAlign: 'right' }} />
                <Legend />
                <Bar dataKey="total" name="סה״כ שיחות" fill="hsl(232, 65%, 40%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="answered" name="ענו" fill="hsl(200, 60%, 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="interested" name="מעוניינים" fill="hsl(51, 100%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}