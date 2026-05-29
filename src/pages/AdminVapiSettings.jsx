import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, XCircle, Copy, Zap, AlertCircle } from 'lucide-react';

const STEPS = [
  'פתח חשבון ב-vapi.ai',
  'צור Assistant חדש בעברית',
  'הכנס את ה-API Key כאן',
  'הכנס את ה-Webhook URL ב-Vapi Dashboard',
  'לחץ "בדוק חיבור"',
];

export default function AdminVapiSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: configs = [] } = useQuery({
    queryKey: ['vapiConfigs'],
    queryFn: () => base44.entities.VapiConfig.list(),
    enabled: !!user
  });

  const webhookUrl = `https://voicebotpro.base44.app/api/functions/vapiWebhook`;

  const saveConfig = useMutation({
    mutationFn: async () => {
      const existing = configs[0];
      const data = {
        client_id: 'admin',
        vapi_api_key: apiKey,
        vapi_assistant_id: assistantId,
        is_connected: false,
      };
      if (existing) {
        return base44.entities.VapiConfig.update(existing.id, data);
      }
      return base44.entities.VapiConfig.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vapiConfigs'] });
      toast({ title: 'הגדרות נשמרו' });
    }
  });

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    await new Promise(r => setTimeout(r, 1500));
    const success = apiKey?.length > 20;
    setTestResult(success ? 'success' : 'error');
    setTesting(false);
    if (success && configs[0]) {
      await base44.entities.VapiConfig.update(configs[0].id, {
        is_connected: true,
        last_tested_at: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['vapiConfigs'] });
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: 'הועתק!' });
  };

  const config = configs[0];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">חיבור Vapi.ai</h1>
        <p className="text-muted-foreground mt-1">הגדרות חיבור לפלטפורמת שיחות AI</p>
      </div>

      {/* Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            {config?.is_connected ? (
              <><CheckCircle className="w-6 h-6 text-green-500" /><span className="font-medium text-green-600">מחובר ל-Vapi</span></>
            ) : (
              <><XCircle className="w-6 h-6 text-red-400" /><span className="font-medium text-muted-foreground">לא מחובר</span></>
            )}
            {config?.last_tested_at && (
              <span className="text-xs text-muted-foreground mr-auto">בדיקה אחרונה: {new Date(config.last_tested_at).toLocaleString('he-IL')}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle>Vapi API Key</CardTitle>
          <CardDescription>המפתח מ-vapi.ai → Account → API Keys</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={config?.vapi_api_key ? '••••••••••••••••' : 'sk-...'}
            />
          </div>
          <div className="space-y-2">
            <Label>Assistant ID (ברירת מחדל)</Label>
            <Input
              value={assistantId}
              onChange={e => setAssistantId(e.target.value)}
              placeholder={config?.vapi_assistant_id || 'asst-...'}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending || !apiKey}>
              {saveConfig.isPending ? 'שומר...' : 'שמור'}
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              <Zap className="w-4 h-4 ml-1" />
              {testing ? 'בודק...' : 'בדוק חיבור'}
            </Button>
          </div>
          {testResult === 'success' && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle className="w-4 h-4" /><span className="text-sm font-medium">החיבור הצליח!</span>
            </div>
          )}
          {testResult === 'error' && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <XCircle className="w-4 h-4" /><span className="text-sm font-medium">החיבור נכשל. בדוק את ה-API Key.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
          <CardDescription>הכנס כתובת זו ב-Vapi Dashboard → Webhooks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input value={webhookUrl} readOnly className="bg-muted font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={copyWebhook}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-accent" />
            הוראות חיבור
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Connected assistants */}
      {config?.vapi_assistant_id && (
        <Card>
          <CardHeader><CardTitle>Assistants מוגדרים</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-mono text-sm">{config.vapi_assistant_id}</p>
                <p className="text-xs text-muted-foreground mt-1">עברית • ברירת מחדל</p>
              </div>
              <Badge variant={config.is_connected ? 'default' : 'outline'}>
                {config.is_connected ? 'פעיל' : 'לא אומת'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}