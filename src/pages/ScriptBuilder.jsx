import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { vapiCreateAssistant, vapiUpdateAssistant } from '@/utils/vapiClient';
import { Save, ArrowRight, Bot, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

const INITIAL_FORM = { name: '', description: '', language: 'he', system_prompt: '', first_message: '', status: 'draft', assigned_client_id: '', vapi_assistant_id: '' };

export default function ScriptBuilder() {
  const { scriptId } = useParams();
  const isNew = scriptId === 'new';
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(INITIAL_FORM);

  const { data: existingScript } = useQuery({
    queryKey: ['script', scriptId],
    queryFn: () => base44.entities.Script.get(scriptId),
    enabled: !isNew,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.filter({ role: 'user' }),
  });

  const { data: vapiConfigs = [] } = useQuery({
    queryKey: ['vapiConfigs'],
    queryFn: () => base44.entities.VapiConfig.list(),
  });

  useEffect(() => {
    if (existingScript) setForm({ ...INITIAL_FORM, ...existingScript });
  }, [existingScript]);

  const apiKey = vapiConfigs[0]?.vapi_api_key;

  const validate = () => {
    if (!form.name.trim()) return 'נא להזין שם תסריט';
    if (!form.system_prompt.trim()) return 'נא להזין System Prompt';
    if (!form.first_message.trim()) return 'נא להזין הודעה ראשונה';
    if (!apiKey) return 'לא הוגדר Vapi API Key – עבור להגדרות מערכת';
    return null;
  };

  const saveScript = useMutation({
    mutationFn: async () => {
      const err = validate();
      if (err) throw new Error(err);

      let vapiAssistantId = form.vapi_assistant_id;

      // Create or update assistant in Vapi
      if (vapiAssistantId) {
        await vapiUpdateAssistant({
          apiKey,
          assistantId: vapiAssistantId,
          name: form.name,
          systemPrompt: form.system_prompt,
          firstMessage: form.first_message,
          language: form.language,
        });
      } else {
        const vapiResult = await vapiCreateAssistant({
          apiKey,
          name: form.name,
          systemPrompt: form.system_prompt,
          firstMessage: form.first_message,
          language: form.language,
        });
        vapiAssistantId = vapiResult.id;
      }

      const scriptData = {
        name: form.name,
        description: form.description,
        language: form.language,
        system_prompt: form.system_prompt,
        first_message: form.first_message,
        status: form.status,
        assigned_client_id: form.assigned_client_id || null,
        vapi_assistant_id: vapiAssistantId,
      };

      if (isNew) {
        const created = await base44.entities.Script.create(scriptData);
        return created.id;
      } else {
        await base44.entities.Script.update(scriptId, scriptData);
        setForm(f => ({ ...f, vapi_assistant_id: vapiAssistantId }));
        return scriptId;
      }
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      queryClient.invalidateQueries({ queryKey: ['script', scriptId] });
      toast({ title: '✅ התסריט נשמר ו-Assistant עודכן ב-Vapi' });
      if (isNew) navigate(`/admin/scripts/${id}`, { replace: true });
    },
    onError: (e) => {
      toast({ title: 'שגיאה', description: e.message, variant: 'destructive' });
    },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/scripts')}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{isNew ? 'תסריט חדש' : 'עריכת תסריט'}</h1>
            <p className="text-muted-foreground mt-1">כל תסריט יוצר Vapi Assistant ייעודי</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {form.vapi_assistant_id && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-mono text-xs">{form.vapi_assistant_id.slice(0, 16)}...</span>
            </div>
          )}
          {!apiKey && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4" /> Vapi API Key חסר
            </div>
          )}
          <Button onClick={() => saveScript.mutate()} disabled={saveScript.isPending} className="gap-2 min-w-[100px]">
            <Save className="w-4 h-4" />
            {saveScript.isPending ? 'שומר ב-Vapi...' : 'שמור'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Script Details */}
        <Card>
          <CardHeader><CardTitle>פרטי תסריט</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>שם התסריט *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="תסריט מכירות – מוצר X" />
            </div>
            <div className="space-y-2">
              <Label>שפת הסוכן *</Label>
              <Select value={form.language} onValueChange={v => set('language', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="he">🇮🇱 עברית</SelectItem>
                  <SelectItem value="ar">🇸🇦 ערבית</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>לקוח מוקצה</Label>
              <Select value={form.assigned_client_id || '_none'} onValueChange={v => set('assigned_client_id', v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="כל הלקוחות" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">ללא הקצאה</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>תיאור (פנימי)</Label>
              <Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="הערות פנימיות..." rows={2} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <Label>תסריט פעיל</Label>
              <Switch checked={form.status === 'active'} onCheckedChange={v => set('status', v ? 'active' : 'draft')} />
            </div>
            {form.status === 'draft' && (
              <p className="text-xs text-muted-foreground">טיוטה = לקוחות לא יכולים לבחור תסריט זה בקמפיין</p>
            )}
          </CardContent>
        </Card>

        {/* Right: AI Prompt */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              הגדרות הסוכן AI
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              הטקסט כאן הופך להוראות הסוכן AI שמתנהל בשיחה בפועל
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-base font-semibold">הודעה ראשונה *</Label>
              <p className="text-xs text-muted-foreground">המשפט הראשון שהסוכן אומר כשהלקוח עונה</p>
              <Textarea
                value={form.first_message}
                onChange={e => set('first_message', e.target.value)}
                placeholder='לדוגמה: "שלום, אני מתקשר בשם חברת X. האם יש לך רגע לשיחה קצרה?"'
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">System Prompt – הוראות לסוכן *</Label>
              <p className="text-xs text-muted-foreground">
                כתוב כאן את הוראות הסוכן המלאות: מה למכור, איך להגיב, מה לא לומר, איך לסגור עסקה
              </p>
              <Textarea
                value={form.system_prompt}
                onChange={e => set('system_prompt', e.target.value)}
                placeholder={`לדוגמה:\nאתה סוכן מכירות של חברת X המתמחה בביטוח חיים.\nמטרתך: לזהות אנשים שמעוניינים לשמוע עוד על מוצרי הביטוח שלנו.\n\nהוראות:\n1. היה ידידותי אך מקצועי\n2. אם הלקוח מעוניין, בקש שם ומספר לחזרה\n3. אם לא מעוניין, סיים בנימוס`}
                rows={14}
                className="font-mono text-sm resize-y"
              />
              {form.system_prompt.length > 0 && (
                <p className="text-xs text-muted-foreground">{form.system_prompt.length} תווים</p>
              )}
            </div>

            {form.vapi_assistant_id && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700">Assistant מחובר ל-Vapi ✓</p>
                  <p className="text-xs text-green-600 font-mono">{form.vapi_assistant_id}</p>
                </div>
              </div>
            )}
            {!form.vapi_assistant_id && !isNew && (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <p className="text-sm text-yellow-700">תסריט זה טרם נוצר ב-Vapi. לחץ "שמור" כדי ליצור אותו.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}