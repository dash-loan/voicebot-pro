import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { vapiCall } from '@/utils/vapiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Phone, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function QuickDial() {
  const [phone, setPhone] = useState('+972');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const { data: vapiConfigs = [] } = useQuery({
    queryKey: ['vapiConfigs'],
    queryFn: () => base44.entities.VapiConfig.list(),
  });
  const vapiPublicKey = vapiConfigs[0]?.vapi_public_key;
  const vapiAssistantId = vapiConfigs[0]?.vapi_assistant_id;
  const vapiPhoneNumberId = vapiConfigs[0]?.vapi_phone_number_id;

  const addLog = (entry) => setLogs(prev => [entry, ...prev]);

  const handleDial = async () => {
    if (!phone || phone.length < 10) {
      addLog({ type: 'error', message: 'מספר טלפון לא תקין', time: new Date().toLocaleTimeString('he-IL') });
      return;
    }

    setLoading(true);
    addLog({ type: 'info', message: `מחייג ל-${phone} (${name || 'ללא שם'})...`, time: new Date().toLocaleTimeString('he-IL') });

    try {
      if (!vapiPublicKey) throw new Error('Vapi Public Key לא הוגדר בהגדרות המערכת');
      const data = await vapiCall({ publicKey: vapiPublicKey, phone, name, assistantId: vapiAssistantId, phoneNumberId: vapiPhoneNumberId });
      addLog({
        type: 'success',
        message: `✅ שיחה הוחלה! Call ID: ${data.id}`,
        detail: JSON.stringify(data, null, 2),
        time: new Date().toLocaleTimeString('he-IL'),
      });
    } catch (err) {
      addLog({
        type: 'error',
        message: `❌ שגיאה: ${err.message}`,
        time: new Date().toLocaleTimeString('he-IL'),
      });
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Phone className="w-7 h-7" /> Quick Dial</h1>
        <p className="text-muted-foreground mt-1">בדיקת שיחה בודדת דרך Vapi API</p>
      </div>

      <Card>
        <CardHeader><CardTitle>חייג עכשיו</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>מספר טלפון</Label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+972501234567"
              dir="ltr"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>שם (אופציונלי)</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="שם הלקוח" />
          </div>
          <Button onClick={handleDial} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מחייג...</> : <><Phone className="w-4 h-4 ml-2" /> חייג עכשיו</>}
          </Button>
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader><CardTitle>לוג שיחות</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {logs.map((log, i) => (
              <div key={i} className={`p-3 rounded-lg text-sm ${log.type === 'success' ? 'bg-green-50 border border-green-200' : log.type === 'error' ? 'bg-red-50 border border-red-200' : 'bg-muted'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{log.message}</span>
                  <span className="text-xs text-muted-foreground">{log.time}</span>
                </div>
                {log.detail && (
                  <pre className="text-xs text-muted-foreground mt-2 overflow-auto max-h-40 font-mono bg-background p-2 rounded" dir="ltr">
                    {log.detail}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}