import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import StatsCard from '@/components/StatsCard';
import { Clock, PhoneCall, UserCheck, UserX, ArrowLeft, Megaphone, Upload, Star } from 'lucide-react';
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
      return all[0] || { total_minutes: 0, used_minutes: 0 };
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
  const remainingMinutes = totalMinutes - usedMinutes;
  const usagePercent = totalMinutes > 0 ? (usedMinutes / totalMinutes) * 100 : 0;

  const totalCalls = callLogs.length;
  const answeredCalls = callLogs.filter(l => l.status === 'answered' || l.status === 'interested' || l.status === 'not_interested').length;
  const interestedCalls = callLogs.filter(l => l.status === 'interested').length;
  const notInterestedCalls = callLogs.filter(l => l.status === 'not_interested').length;

  const answerRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;
  const interestRate = answeredCalls > 0 ? Math.round((interestedCalls / answeredCalls) * 100) : 0;

  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const recentCampaigns = campaigns.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">שלום, {user?.full_name || 'לקוח'} 👋</h1>
        <p className="text-muted-foreground mt-1">הנה סקירה מהירה של הפעילות שלך</p>
      </div>

      <Card className="bg-gradient-to-l from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-primary" />
                <span className="font-medium">בנק דקות</span>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-bold">{remainingMinutes.toLocaleString()}</span>
                <span className="text-muted-foreground">/ {totalMinutes.toLocaleString()} דקות נותרו</span>
              </div>
              <Progress value={usagePercent} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">{usedMinutes.toLocaleString()} דקות שנוצלו ({Math.round(usagePercent)}%)</p>
            </div>
            <div className="flex flex-col gap-2">
              {remainingMinutes < 100 && remainingMinutes > 0 && <Badge variant="destructive">דקות מתמעטות!</Badge>}
              {remainingMinutes === 0 && <Badge variant="destructive">נגמרו הדקות</Badge>}
              <Link to="/campaigns">
                <Button className="gap-2 w-full">
                  <Upload className="w-4 h-4" /> העלה רשימת לקוחות
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="סה״כ שיחות" value={totalCalls} icon={PhoneCall} />
        <StatsCard title="אחוז מענה" value={`${answerRate}%`} subtitle={`${answeredCalls} ענו`} icon={UserCheck} color="gold" />
        <StatsCard title="מעוניינים" value={interestedCalls} subtitle={`${interestRate}% מהמענים`} icon={Star} />
        <StatsCard title="לא מעוניינים" value={notInterestedCalls} icon={UserX} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>קמפיינים פעילים</CardTitle>
            <Link to="/campaigns"><Button variant="ghost" size="sm" className="gap-2">כל הקמפיינים <ArrowLeft className="w-4 h-4" /></Button></Link>
          </CardHeader>
          <CardContent>
            {activeCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">אין קמפיינים פעילים</p>
                <Link to="/campaigns"><Button className="mt-4 gap-2"><Upload className="w-4 h-4" /> צור קמפיין חדש</Button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeCampaigns.map(campaign => (
                  <Link key={campaign.id} to={`/campaigns/${campaign.id}`} className="block">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">{campaign.dialed_contacts || 0} / {campaign.total_contacts || 0} שיחות</p>
                      </div>
                      <Badge>פעיל</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>לקוחות מעוניינים אחרונים</CardTitle>
            <Link to="/results"><Button variant="ghost" size="sm" className="gap-2">כל התוצאות <ArrowLeft className="w-4 h-4" /></Button></Link>
          </CardHeader>
          <CardContent>
            {interestedCalls === 0 ? (
              <p className="text-center py-8 text-muted-foreground">אין מעוניינים עדיין</p>
            ) : (
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-4xl font-bold text-green-700">{interestedCalls}</p>
                <p className="text-green-600 mt-1">לקוחות מעוניינים</p>
                <Link to="/results?status=interested"><Button variant="outline" className="mt-3 gap-2 border-green-300 text-green-700 hover:bg-green-100"><Star className="w-4 h-4" /> הורד רשימה</Button></Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}