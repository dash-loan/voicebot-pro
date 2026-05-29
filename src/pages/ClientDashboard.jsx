import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import StatsCard from '@/components/StatsCard';
import { Clock, PhoneCall, UserCheck, UserX, ArrowLeft, Megaphone } from 'lucide-react';
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
                <span className="text-muted-foreground">/ {totalMinutes.toLocaleString()} דקות</span>
              </div>
              <Progress value={usagePercent} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">{usedMinutes.toLocaleString()} דקות נוצלו ({Math.round(usagePercent)}%)</p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2">
              {remainingMinutes < 100 && remainingMinutes > 0 && (
                <Badge variant="destructive">דקות מתמעטות!</Badge>
              )}
              {remainingMinutes === 0 && (
                <Badge variant="destructive">נגמרו הדקות</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="סה״כ שיחות" value={totalCalls} icon={PhoneCall} />
        <StatsCard title="אחוז מענה" value={`${answerRate}%`} subtitle={`${answeredCalls} ענו`} icon={UserCheck} color="gold" />
        <StatsCard title="אחוז מעוניינים" value={`${interestRate}%`} subtitle={`${interestedCalls} מעוניינים`} icon={UserCheck} />
        <StatsCard title="לא מעוניינים" value={notInterestedCalls} icon={UserX} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>קמפיינים פעילים</CardTitle>
            <Link to="/campaigns">
              <Button variant="ghost" size="sm" className="gap-2">
                כל הקמפיינים <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {activeCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">אין קמפיינים פעילים</p>
                <Link to="/campaigns"><Button className="mt-4">צור קמפיין ראשון</Button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeCampaigns.map(campaign => (
                  <Link key={campaign.id} to={`/campaigns/${campaign.id}`} className="block">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">{campaign.dialed_contacts || 0} / {campaign.total_contacts || 0} חויגו</p>
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
          <CardHeader><CardTitle>קמפיינים אחרונים</CardTitle></CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">אין קמפיינים עדיין</p>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map(campaign => (
                  <Link key={campaign.id} to={`/campaigns/${campaign.id}`} className="block">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">{campaign.answered_contacts || 0} מענים</p>
                      </div>
                      <Badge variant={campaign.status === 'active' ? 'default' : campaign.status === 'completed' ? 'secondary' : 'outline'}>
                        {campaign.status === 'active' ? 'פעיל' : campaign.status === 'completed' ? 'הושלם' : campaign.status === 'paused' ? 'מושהה' : 'טיוטה'}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}