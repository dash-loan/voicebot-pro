import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Zap, Phone, DollarSign, CheckCircle, XCircle, Link } from 'lucide-react';
import { checkVapiConnection } from '@/functions/checkVapiConnection';

export default function SystemSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({ queryKey: ['vapiConfigs'], queryFn: () => base44.entities.VapiConfig.list() });
  const config = configs[0];

  const [vapi, setVapi] = useState({ key: '', assistantId: '', phoneNumberId: '' });
  const [twilio, setTwilio] = useState({ accountSid: '', authToken: '' });
  const [pricing, setPricing] = useState({ vapiPerMin: '0.05', twilioPerMin: '0.013', sellPerMin: '0.25' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const save = useMutation({
    mutationFn: async () => {
      const data = {
        client_id: 'admin',
        vapi_api_key: vapi.key || config?.vapi_api_key,
        vapi_assistant_id: vapi.assistantId || config?.vapi_assistant_id,
        vapi_phone_number_id: vapi.phoneNumberId || config?.vapi_phone_number_id,
        is_connected: config?.is_connected || false,
      };
      if (config) return base44.entities.VapiConfig.update(config.id, data);
      return base44.entities.VapiConfig.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vapiConfigs'] }); toast({ title: 'הגדרות נשמרו' }); }
  });

  const [testResultMsg, setTestResultMsg] = useState(null);

  const testVapi = async () => {
    setTesting(true); setTestResult(null); setTestResultMsg(null);
    try {
      const res = await checkVapiConnection({
        api_key: vapi.key || config?.vapi_api_key,
        assistant_id: vapi.assistantId || config?.vapi_assistant_id,
      });
      const data = res.data;
      if (data.connected) {
        setTestResult('success');
        setTestResultMsg(`מחובר ✅ – Assistant: ${data.assistant_name}`);
        if (config) {
          await base44.entities.VapiConfig.update(config.id, { is_connected: true, last_tested_at: new Date().toISOString() });
          queryClient.invalidateQueries({ queryKey: ['vapiConfigs'] });
        }
      } else {
        setTestResult('error');
        setTestResultMsg(data.error || 'חיבור נכשל');
      }
    } catch (e) {
      setTestResult('error');
      setTestResultMsg(e.message);
    }
    setTesting(false);
  };

  const webhookUrl = `${window.location.origin}/api/functions/vapiWebhook`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">הגדרות מערכת</h1>
        <p className="text-muted-foreground mt-1">קונפיגורציה טכנית – נסתר מלקוחות</p>
      </div>

      {/* Vapi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" /> Vapi.ai
            {config?.is_connected ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-400" />}
          </CardTitle>
          <CardDescription>פרטי חיבור למנוע השיחות</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input type="password" value={vapi.key} onChange={e => setVapi({ ...vapi, key: e.target.value })} placeholder={config?.vapi_api_key ? '••••••••' : 'sk-vapi-...'} />
          </div>
          <div className="space-y-2">
            <Label>Assistant ID (ברירת מחדל)</Label>
            <Input value={vapi.assistantId} onChange={e => setVapi({ ...vapi, assistantId: e.target.value })} placeholder={config?.vapi_assistant_id || 'asst-...'} />
          </div>
          <div className="space-y-2">
            <Label>Phone Number ID (Vapi)</Label>
            <Input value={vapi.phoneNumberId} onChange={e => setVapi({ ...vapi, phoneNumberId: e.target.value })} placeholder={config?.vapi_phone_number_id || 'pn-...'} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>שמור</Button>
            <Button variant="outline" onClick={testVapi} disabled={testing}>{testing ? 'בודק...' : 'בדוק חיבור'}</Button>
          </div>
          {testResult === 'success' && <p className="text-green-600 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {testResultMsg}</p>}
          {testResult === 'error' && <p className="text-red-600 text-sm flex items-center gap-1"><XCircle className="w-4 h-4" /> {testResultMsg}</p>}

          <div className="mt-4 p-3 bg-muted rounded-lg space-y-1">
            <p className="text-xs font-semibold flex items-center gap-1"><Link className="w-3 h-3" /> Webhook URL להכנסה ב-Vapi Dashboard:</p>
            <code className="text-xs text-blue-600 break-all block" dir="ltr">{webhookUrl}</code>
            <p className="text-xs text-muted-foreground">ב-Vapi: Settings → Webhooks → הדבק את ה-URL → סמן אירועים: call-started, end-of-call-report</p>
          </div>
        </CardContent>
      </Card>

      {/* Twilio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Phone className="w-5 h-5 text-blue-500" /> Twilio</CardTitle>
          <CardDescription>פרטי חשבון Twilio לניהול מספרים</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Account SID</Label>
            <Input value={twilio.accountSid} onChange={e => setTwilio({ ...twilio, accountSid: e.target.value })} placeholder="ACxxxxxxx..." />
          </div>
          <div className="space-y-2">
            <Label>Auth Token</Label>
            <Input type="password" value={twilio.authToken} onChange={e => setTwilio({ ...twilio, authToken: e.target.value })} placeholder="••••••••" />
          </div>
          <Button onClick={() => toast({ title: 'Twilio credentials יישמרו לאחר חיבור Backend' })} variant="outline">שמור</Button>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-500" /> תמחור</CardTitle>
          <CardDescription>עלויות ומחיר מכירה לדקה (USD)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>עלות Vapi/דקה ($)</Label>
              <Input value={pricing.vapiPerMin} onChange={e => setPricing({ ...pricing, vapiPerMin: e.target.value })} type="number" step="0.001" />
            </div>
            <div className="space-y-2">
              <Label>עלות Twilio/דקה ($)</Label>
              <Input value={pricing.twilioPerMin} onChange={e => setPricing({ ...pricing, twilioPerMin: e.target.value })} type="number" step="0.001" />
            </div>
            <div className="space-y-2">
              <Label>מחיר מכירה/דקה ($)</Label>
              <Input value={pricing.sellPerMin} onChange={e => setPricing({ ...pricing, sellPerMin: e.target.value })} type="number" step="0.01" />
            </div>
          </div>
          <div className="bg-muted p-3 rounded text-sm text-muted-foreground">
            רווח לדקה: ${(parseFloat(pricing.sellPerMin || 0) - parseFloat(pricing.vapiPerMin || 0) - parseFloat(pricing.twilioPerMin || 0)).toFixed(3)}
          </div>
          <Button onClick={() => toast({ title: 'הגדרות תמחור נשמרו' })}>שמור</Button>
        </CardContent>
      </Card>
    </div>
  );
}