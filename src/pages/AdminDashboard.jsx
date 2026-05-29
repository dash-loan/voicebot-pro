import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import StatsCard from '@/components/StatsCard';
import { Users, Clock, PhoneCall, TrendingUp, ArrowLeft, FileText, Mic, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboard() {
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.filter({ role: 'user' })
  });
  
  const { data: clientMinutes = [] } = useQuery({
    queryKey: ['clientMinutes'],
    queryFn: () => base44.entities.ClientMinutes.list()
  });
  
  const { data: campaigns = [] } = useQuery({
    queryKey: ['allCampaigns'],
    queryFn: () => base44.entities.Campaign.list()
  });
  
  const { data: scripts = [] } = useQuery({
    queryKey: ['scripts'],
    queryFn: () => base44.entities.Script.list()
  });

  const totalMinutes = clientMinutes.reduce((sum, cm) => sum + (cm.total_minutes || 0), 0);
  const usedMinutes = clientMinutes.reduce((sum, cm) => sum + (cm.used_minutes || 0), 0);
  const activeClients = users.filter(u => u.status === 'active').length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  const recentClients = users.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">דשבורד ניהול</h1>
        <p className="text-muted-foreground mt-1">סקירה כללית של המערכת</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="סה״כ לקוחות" value={users.length} subtitle={`${activeClients} פעילים`} icon={Users} />
        <StatsCard title="דקות שהוקצו" value={totalMinutes.toLocaleString()} subtitle={`${usedMinutes.toLocaleString()} נוצלו`} icon={Clock} color="gold" />
        <StatsCard title="קמפיינים פעילים" value={activeCampaigns} subtitle={`מתוך ${campaigns.length}`} icon={PhoneCall} />
        <StatsCard title="תסריטים" value={scripts.length} subtitle={`${scripts.filter(s => s.status === 'active').length} פעילים`} icon={FileText} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>לקוחות אחרונים</CardTitle>
            <Link to="/admin/clients">
              <Button variant="ghost" size="sm" className="gap-2">
                כל הלקוחות <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">אין לקוחות עדיין</p>
            ) : (
              <div className="space-y-3">
                {recentClients.map(client => {
                  const cm = clientMinutes.find(c => c.client_id === client.id);
                  return (
                    <div key={client.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{client.full_name || client.email}</p>
                        <p className="text-sm text-muted-foreground">{client.company_name || 'לא צוין'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <p className="text-sm font-medium">{cm?.total_minutes || 0} דקות</p>
                          <p className="text-xs text-muted-foreground">{cm?.used_minutes || 0} נוצלו</p>
                        </div>
                        <Badge variant={client.status === 'active' ? 'default' : 'destructive'}>
                          {client.status === 'active' ? 'פעיל' : 'חסום'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>פעולות מהירות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/admin/clients" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Users className="w-5 h-5" />
                הוסף לקוח חדש
              </Button>
            </Link>
            <Link to="/admin/scripts" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <FileText className="w-5 h-5" />
                צור תסריט חדש
              </Button>
            </Link>
            <Link to="/admin/tts" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Mic className="w-5 h-5" />
                הפק קובץ שמע
              </Button>
            </Link>
            <Link to="/admin/numbers" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Phone className="w-5 h-5" />
                נהל מספרים
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}