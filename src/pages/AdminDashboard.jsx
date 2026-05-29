import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import StatsCard from '@/components/StatsCard';
import { Users, Clock, PhoneCall, TrendingUp, ArrowLeft, FileText, Mic, Phone, DollarSign } from 'lucide-react';
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

  const { data: callLogs = [] } = useQuery({ queryKey: ['allCallLogs'], queryFn: () => base44.entities.CallLog.list() });
  const { data: vapiConfigs = [] } = useQuery({ queryKey: ['vapiConfigs'], queryFn: () => base44.entities.VapiConfig.list() });
  const { data: numbers = [] } = useQuery({ queryKey: ['virtualNumbers'], queryFn: () => base44.entities.VirtualNumber.list() });

  const totalMinutes = clientMinutes.reduce((sum, cm) => sum + (cm.total_minutes || 0), 0);
  const usedMinutes = clientMinutes.reduce((sum, cm) => sum + (cm.used_minutes || 0), 0);
  const activeClients = users.filter(u => u.status === 'active').length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalRevenue = usedMinutes * 0.25;
  const totalCost = callLogs.reduce((s, l) => s + (l.vapi_cost || 0), 0) + (callLogs.reduce((s, l) => s + (l.active_duration_seconds || l.duration || 0), 0) / 60) * 0.013;
  const totalProfit = totalRevenue - totalCost;

  const recentClients = users.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">דשבורד ניהול</h1>
        <p className="text-muted-foreground mt-1">סקירה כללית של המערכת</p>
      </div>

      {/* Quick Start Checklist */}
      <div className="bg-gradient-to-l from-primary/5 to-transparent border border-primary/20 rounded-xl p-6 space-y-3">
        <h2 className="font-bold text-lg">🚀 צעדים להפעלה</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'מערכת מוכנה', done: true },
            { label: 'חבר חשבון Vapi', done: vapiConfigs[0]?.is_connected, link: '/admin/settings' },
            { label: 'הוסף מספר וירטואלי', done: numbers.length > 0, link: '/admin/numbers' },
            { label: 'צור תסריט ראשון', done: scripts.length > 0, link: '/admin/scripts' },
            { label: 'הוסף לקוח ראשון', done: users.length > 0, link: '/admin/clients' },
          ].map((step, i) => (
            step.link && !step.done ? (
              <Link key={i} to={step.link} className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <span className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0"/>
                <span className="text-sm text-muted-foreground">{step.label}</span>
              </Link>
            ) : (
              <div key={i} className={`flex items-center gap-2 p-3 rounded-lg border ${step.done ? 'bg-green-50 border-green-200' : 'bg-card'}`}>
                <span className="text-lg">{step.done ? '✅' : '⬜'}</span>
                <span className={`text-sm font-medium ${step.done ? 'text-green-700' : 'text-muted-foreground'}`}>{step.label}</span>
              </div>
            )
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="סה״כ לקוחות" value={users.length} subtitle={`${activeClients} פעילים`} icon={Users} />
        <StatsCard title="דקות שהוקצו" value={totalMinutes.toLocaleString()} subtitle={`${usedMinutes.toLocaleString()} נוצלו`} icon={Clock} color="gold" />
        <StatsCard title="קמפיינים פעילים" value={activeCampaigns} subtitle={`מתוך ${campaigns.length}`} icon={PhoneCall} />
        <StatsCard title="תסריטים" value={scripts.length} subtitle={`${scripts.filter(s => s.status === 'active').length} פעילים`} icon={FileText} />
        <StatsCard title="רווח נקי החודש" value={`$${totalProfit.toFixed(0)}`} subtitle={`הכנסות $${totalRevenue.toFixed(0)}`} icon={DollarSign} color="gold" />
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
            <Link to="/admin/profitability" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <TrendingUp className="w-5 h-5" />
                דוח רווחיות
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}