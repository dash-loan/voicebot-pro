import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Clock, PhoneCall, Upload, Megaphone, Flame, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function ClientDashboard() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: clientMinutes } = useQuery({
    queryKey: ['myMinutes', user?.id],
    queryFn: async () => {
      const all = await base44.entities.ClientMinutes.filter({ client_id: user.id });
      return all[0] || { total_minutes: 0, used_minutes: 0, remaining_minutes: 0 };
    },
    enabled: !!user?.id
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['myCampaigns', user?.id],
    queryFn: () => base44.entities.Campaign.filter({ client_id: user?.id }),
    enabled: !!user?.id
  });

  const { data: callLogs = [] } = useQuery({
    queryKey: ['myCallLogs', user?.id],
    queryFn: () => base44.entities.CallLog.filter({ client_id: user?.id }),
    enabled: !!user?.id
  });

  const totalMinutes = clientMinutes?.total_minutes || 0;
  const usedMinutes = clientMinutes?.used_minutes || 0;
  const remainingMinutes = clientMinutes?.remaining_minutes ?? (totalMinutes - usedMinutes);
  const usagePercent = totalMinutes > 0 ? Math.min(100, (usedMinutes / totalMinutes) * 100) : 0;
  const lowMinutes = remainingMinutes > 0 && remainingMinutes < 100;

  const hotLeads = callLogs.filter(l => l.lead_quality === 'hot_lead').length;
  const warmLeads = callLogs.filter(l => l.lead_quality === 'warm_lead').length;
  const totalCalls = callLogs.length;
  const answeredCalls = callLogs.filter(l => ['answered', 'interested', 'not_interested', 'hot_lead', 'warm_lead', 'qualified'].includes(l.status)).length;
  const conversionRate = totalCalls > 0 ? Math.round(((hotLeads + warmLeads) / totalCalls) * 100) : 0;

  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">שלום, {user?.full_name || 'לקוח'} 👋</h1>
        <p className="text-muted-foreground mt-1">הנה סקירה מהירה של הפעילות שלך</p>
      </div>

      {/* Minutes Bank */}
      <Card className={`border-2 ${lowMinutes ? 'border-red-300 bg-red-50/30' : remainingMinutes === 0 ? 'border-red-400 bg-red-50/50' : 'border-primary/20 bg-gradient-to-l from-primary/5 to-transparent'}`}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-primary" />
                <span className="font-bold text-lg">בנק דקות</span>
                {lowMinutes && <Badge variant="destructive">דקות מתמעטות!</Badge>}
                {remainingMinutes === 0 && <Badge variant="destructive">נגמרו הדקות</Badge>}
              </div>
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-5xl font-bold text-primary">{Math.round(remainingMinutes).toLocaleString()}</span>
                <span className="text-muted-foreground text-lg">דקות נותרו</span>
              </div>
              <Progress value={usagePercent} className="h-3" />
              <div className="flex items-center gap-6 mt-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary/30 inline-block" />
                  <span className="text-muted-foreground">נרכשו:</span>
                  <span className="font-semibold">{Math.round(totalMinutes).toLocaleString()} דקות</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
                  <span className="text-muted-foreground">נוצלו:</span>
                  <span className="font-semibold">{Math.round(usedMinutes).toLocaleString()} דקות ({Math.round(usagePercent)}%)</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 min-w-[180px]">
              <Link to="/campaigns">
                <Button className="gap-2 w-full" size="lg">
                  <Upload className="w-5 h-5" /> העלה קובץ לקוחות
                </Button>
              </Link>
              <Link to="/results">
                <Button variant="outline" className="gap-2 w-full">
                  <TrendingUp className="w-4 h-4" /> ראה תוצאות
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hot Leads Hero */}
      {(hotLeads > 0 || warmLeads > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-red-50">
            <CardContent className="p-6 text-center">
              <div className="text-6xl font-black text-orange-600 mb-2">{hotLeads}</div>
              <div className="text-xl font-bold text-orange-700 mb-1">לידים חמים 🔥</div>
              <p className="text-muted-foreground text-sm mb-4">לקוחות שהביעו עניין ברור</p>
              <Link to="/quality-leads">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                  <Flame className="w-4 h-4" /> צפה בלידים החמים
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50">
            <CardContent className="p-6 text-center">
              <div className="text-6xl font-black text-yellow-600 mb-2">{warmLeads}</div>
              <div className="text-xl font-bold text-yellow-700 mb-1">לידים חמים חלקית</div>
              <p className="text-muted-foreground text-sm mb-4">הראו עניין חלקי – שווה לחזור</p>
              <Link to="/quality-leads?quality=warm">
                <Button variant="outline" className="border-yellow-400 text-yellow-700 hover:bg-yellow-100 gap-2">
                  צפה בלידים
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'סה"כ שיחות', value: totalCalls, color: 'text-primary', icon: PhoneCall },
          { label: 'לידים חמים', value: hotLeads, color: 'text-orange-600', icon: Flame },
          { label: 'אחוז המרה', value: `${conversionRate}%`, color: 'text-green-600', icon: TrendingUp },
          { label: 'קמפיינים פעילים', value: activeCampaigns.length, color: 'text-blue-600', icon: Megaphone },
        ].map(stat => (
          <div key={stat.label} className="border rounded-xl p-5 bg-card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Highlight: total calls → hot leads */}
      {totalCalls > 0 && (
        <div className="bg-gradient-to-l from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5 text-center">
          <p className="text-2xl font-bold text-primary">
            מתוך <span className="text-3xl">{totalCalls.toLocaleString()}</span> שיחות → <span className="text-3xl text-orange-500">{hotLeads}</span> לידים חמים 🔥
          </p>
          {conversionRate > 0 && <p className="text-muted-foreground mt-1">אחוז המרה: {conversionRate}%</p>}
        </div>
      )}

      {/* Active Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>קמפיינים פעילים</CardTitle>
          <Link to="/campaigns"><Button variant="ghost" size="sm">כל הקמפיינים</Button></Link>
        </CardHeader>
        <CardContent>
          {activeCampaigns.length === 0 ? (
            <div className="text-center py-10">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">אין קמפיינים פעילים</p>
              <Link to="/campaigns"><Button className="mt-4 gap-2"><Upload className="w-4 h-4" /> צור קמפיין חדש</Button></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCampaigns.map(c => (
                <Link key={c.id} to={`/campaigns/${c.id}`} className="block">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-muted-foreground">{c.dialed_contacts || 0} / {c.total_contacts || 0} שיחות</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${c.total_contacts > 0 ? (c.dialed_contacts / c.total_contacts) * 100 : 0}%` }}
                        />
                      </div>
                      <Badge>פעיל</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}