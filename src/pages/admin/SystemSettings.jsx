import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Zap, Phone, DollarSign, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { checkVapiConnection } from '@/functions/checkVapiConnection';

export default function SystemSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ['vapiConfigs'],
    queryFn: () => base44.entities.VapiConfig.list(),
    staleTime: 60000,
  });
  const config = configs[0];

  const { data: settingsList = [] } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: () => base44.entities.SystemSettings.filter({ key: 'pricing' }),
    staleTime: 60000,
  });
  const pricingRecord = settingsList[0];

  const [vapi, setVapi] = useState({ key: '', assistantId: '', phoneNumberId: '' });
  const [pricing, setPricing] = useState({ vapiPerMin: '0.05', twilioPerMin: '0.013', sellPerMin: '0.25' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testResultMsg, setTestResultMsg] = useState(null);

  // Sync pricing from DB when loaded
  useEffect(() => {
    if (pricingRecord) {
      setPricing({
        vapiPerMin: String(pricingRecord.vapi_per_min ?? 0.05),
        twilioPerMin: String(pricingRecord.twilio_per_min ?? 0.013),
        sellPerMin: String(pricingRecord.sell_per_min ?? 0.25),
      });
    }
  }, [pricingRecord]);

  const saveVapi = useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vapiConfigs'] });
      toast({ title: 'הגדרות Vapi נשמרו' });
    }
  });

  const savePricing = useMutation({
    mutationFn: async () => {
      const data = {
        key: 'pricing',
        vapi_per_min: parseFloat(pricing.vapiPerMin),
        twilio_per_min: parseFloat(pricing.twilioPerMin),
        sell_per_min: parseFloat(pricing.sellPerMin),
      };
      if (pricingRecord) return base44.entities.SystemSettings.update(pricingRecord.id, data);
      return base44.entities.SystemSettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      toast({ title: 'הגדרות תמחור נשמרו ✅' });
    }
  });

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
  const profit = (parseFloat(pricing.sellPerMin || 0) - parseFloat(pricing.vapiPerMin || 0) - parseFloat(pricing.twilioPerMin || 0)).toFixed(3);

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
            <Input
              type="password"
              value={vapi.key}
              onChange={e => setVapi({ ...vapi, key: e.target.value })}
              placeholder={config?.vapi_api_key ? '••••••••  (שמור)' : 'sk-vapi-...'}
            />
          </div>
          <div className="space-y-2">
            <Label>Assistant ID (ברירת מחדל)</Label>
            <Input
              value={vapi.assistantId}
              onChange={e => setVapi({ ...vapi, assistantId: e.target.value })}
              placeholder={config?.vapi_assistant_id || 'asst-...'}
              dir="ltr"
            />
            {config?.vapi_assistant_id && !vapi.assistantId && (
              <p className="text-xs text-muted-foreground">נוכחי: {config.vapi_assistant_id}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Phone Number ID (Vapi)</Label>
            <Input
              value={vapi.phoneNumberId}
              onChange={e => setVapi({ ...vapi, phoneNumberId: e.target.value })}
              placeholder={config?.vapi_phone_number_id || 'pn-...'}
              dir="ltr"
            />
            {config?.vapi_phone_number_id && !vapi.phoneNumberId && (
              <p className="text-xs text-muted-foreground">נוכחי: {config.vapi_phone_number_id}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveVapi.mutate()} disabled={saveVapi.isPending}>שמור</Button>
            <Button variant="outline" onClick={testVapi} disabled={testing}>{testing ? 'בודק...' : 'בדוק חיבור'}</Button>
          </div>
          {testResult === 'success' && <p className="text-green-600 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {testResultMsg}</p>}
          {testResult === 'error' && <p className="text-red-600 text-sm flex items-center gap-1"><XCircle className="w-4 h-4" /> {testResultMsg}</p>}

          <div className="mt-4 p-3 bg-muted rounded-lg space-y-1">
            <p className="text-xs font-semibold flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Webhook URL להכנסה ב-Vapi Dashboard:</p>
            <code className="text-xs text-blue-600 break-all block" dir="ltr">{webhookUrl}</code>
            <p className="text-xs text-muted-foreground">ב-Vapi: Settings → Webhooks → הדבק את ה-URL → סמן אירועים: call-started, end-of-call-report</p>
          </div>
        </CardContent>
      </Card>

      {/* Twilio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Phone className="w-5 h-5 text-blue-500" /> Twilio</CardTitle>
          <CardDescription>פרטי חשבון Twilio לניהול מספרים — מאוחסן ב-Secrets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-3 rounded text-sm text-muted-foreground space-y-1">
            <p>✅ TWILIO_ACCOUNT_SID — מוגדר</p>
            <p>✅ TWILIO_AUTH_TOKEN — מוגדר</p>
            <p className="text-xs mt-2">לשינוי: Dashboard → Settings → Environment Variables</p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-500" /> תמחור</CardTitle>
          <CardDescription>עלויות ומחיר מכירה לדקה (USD) — נשמר ב-DB</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>עלות Vapi/דקה ($)</Label>
              <Input
                value={pricing.vapiPerMin}
                onChange={e => setPricing({ ...pricing, vapiPerMin: e.target.value })}
                type="number"
                step="0.001"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>עלות Twilio/דקה ($)</Label>
              <Input
                value={pricing.twilioPerMin}
                onChange={e => setPricing({ ...pricing, twilioPerMin: e.target.value })}
                type="number"
                step="0.001"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>מחיר מכירה/דקה ($)</Label>
              <Input
                value={pricing.sellPerMin}
                onChange={e => setPricing({ ...pricing, sellPerMin: e.target.value })}
                type="number"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <div className={`p-3 rounded text-sm font-medium ${parseFloat(profit) > 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            רווח לדקה: ${profit}
          </div>
          <Button onClick={() => savePricing.mutate()} disabled={savePricing.isPending}>
            {savePricing.isPending ? 'שומר...' : 'שמור תמחור'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}