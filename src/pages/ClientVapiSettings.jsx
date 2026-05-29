import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, DollarSign, Activity } from 'lucide-react';
import { startOfMonth } from 'date-fns';

export default function ClientVapiSettings() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: configs = [] } = useQuery({
    queryKey: ['vapiConfigs'],
    queryFn: () => base44.entities.VapiConfig.list(),
  });

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

  const adminConfig = configs.find(c => c.client_id === 'admin');
  const isConnected = !!adminConfig?.is_connected;

  const myAssistantId = campaigns.find(c => c.vapi_assistant_id)?.vapi_assistant_id
    || adminConfig?.vapi_assistant_id;

  const monthStart = startOfMonth(new Date());
  const monthLogs = callLogs.filter(l => l.created_date && new Date(l.created_date) >= monthStart);
  const activeSeconds = monthLogs.reduce((sum, l) => sum + (l.active_duration_seconds || l.duration || 0), 0);
  const activeMinutes = Math.ceil(activeSeconds / 60);
  const vapiCost = monthLogs.reduce((sum, l) => sum + (l.vapi_cost || 0), 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">הגדרות Vapi</h1>
        <p className="text-muted-foreground mt-1">סטטוס חיבור ונתוני שימוש</p>
      </div>

      <Card>
        <CardHeader><CardTitle>סטטוס חיבור</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="font-semibold text-green-600">מחובר ל-Vapi</p>
                  <p className="text-sm text-muted-foreground">מערכת השיחות פעילה</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-8 h-8 text-red-400" />
                <div>
                  <p className="font-semibold text-muted-foreground">לא מחובר</p>
                  <p className="text-sm text-muted-foreground">פנה למנהל המערכת לחיבור Vapi</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {myAssistantId && (
        <Card>
          <CardHeader><CardTitle>Vapi Assistant שהוקצה</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm">
              {myAssistantId}
            </div>
            <p className="text-xs text-muted-foreground mt-2">ה-Assistant הזה יבצע את השיחות בקמפיינים שלך</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>סטטיסטיקת שימוש החודש</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <Activity className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-700">{activeMinutes}</p>
            <p className="text-sm text-blue-600">דקות פעילות</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center">
            <DollarSign className="w-6 h-6 text-amber-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-amber-700">${vapiCost.toFixed(2)}</p>
            <p className="text-sm text-amber-600">עלות Vapi</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <Clock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-purple-700">{monthLogs.length}</p>
            <p className="text-sm text-purple-600">שיחות שנענו</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>הסבר חישוב דקות</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>✅ נספרות רק שיחות שנענו ועם זמן שיחה פעיל</p>
          <p>❌ שיחות שלא נענו אינן נספרות</p>
          <p>❌ זמן המתנה לפני מענה אינו נספר</p>
          <p>📊 החישוב מבוסס על <strong>activeDurationSeconds</strong> מ-Vapi</p>
        </CardContent>
      </Card>
    </div>
  );
}