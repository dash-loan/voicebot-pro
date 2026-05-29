import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatsCard from '@/components/StatsCard';
import { ArrowRight, Play, Pause, Square, Users, PhoneCall, UserCheck, Clock, Zap, Star } from 'lucide-react';
import { deductMinutes } from '@/functions/deductMinutes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [simulating, setSimulating] = useState(false);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => base44.entities.Campaign.get(campaignId)
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['campaignContacts', campaignId],
    queryFn: () => base44.entities.Contact.filter({ campaign_id: campaignId })
  });

  const { data: script } = useQuery({
    queryKey: ['script', campaign?.script_id],
    queryFn: () => base44.entities.Script.get(campaign.script_id),
    enabled: !!campaign?.script_id
  });

  const updateStatus = useMutation({
    mutationFn: async (status) => {
      await base44.entities.Campaign.update(campaignId, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      toast({ title: 'סטטוס הקמפיין עודכן' });
    }
  });

  const simulateCalls = useMutation({
    mutationFn: async () => {
      setSimulating(true);
      const user = await base44.auth.me();
      // Process up to 30 pending contacts per run
      const pendingContacts = contacts.filter(c => c.status === 'pending').slice(0, 30);
      if (pendingContacts.length === 0) return 0;

      // Realistic distribution: 20% interested, 20% not_interested, 20% answered, 25% no_answer, 15% voicemail
      const weightedStatuses = [
        ...Array(20).fill('interested'),
        ...Array(20).fill('not_interested'),
        ...Array(20).fill('answered'),
        ...Array(25).fill('no_answer'),
        ...Array(15).fill('voicemail'),
      ];

      const mockTranscripts = [
        [{ role: 'bot', text: 'שלום, אני מתקשר בשם החברה. האם אתה מעוניין לשמוע על המבצע?' }, { role: 'user', text: 'כן, אשמח לשמוע.' }, { role: 'bot', text: 'מצוין! נציג שלנו יחזור אליך בהקדם עם פרטים נוספים.' }, { role: 'user', text: 'תודה.' }],
        [{ role: 'bot', text: 'שלום, אני מתקשר בשם החברה. מתי נוח לך לשמוע על ההצעה?' }, { role: 'user', text: 'לא מעוניין, תודה.' }, { role: 'bot', text: 'מובן לחלוטין. תודה על הזמן!' }],
        [{ role: 'bot', text: 'שלום! אני מתקשר לגבי המבצע המיוחד שלנו.' }, { role: 'user', text: 'אין לי עניין בזה.' }, { role: 'bot', text: 'מכובד, שיהיה לך יום טוב.' }],
      ];

      let totalSeconds = 0;
      let totalVapiCost = 0;

      for (const contact of pendingContacts) {
        const statusIndex = Math.floor(Math.random() * weightedStatuses.length);
        const status = weightedStatuses[statusIndex];
        const isTalked = ['answered', 'interested', 'not_interested'].includes(status);
        const activeSec = isTalked ? Math.floor(Math.random() * 80) + 30 : Math.floor(Math.random() * 15) + 5;
        const vapiCost = (activeSec / 60) * 0.05;
        totalSeconds += activeSec;
        totalVapiCost += vapiCost;

        const transcriptJson = isTalked
          ? JSON.stringify(mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)])
          : null;

        await base44.entities.Contact.update(contact.id, {
          status,
          attempts: (contact.attempts || 0) + 1,
          last_attempt: new Date().toISOString(),
          duration: activeSec,
        });

        await base44.entities.CallLog.create({
          contact_id: contact.id,
          campaign_id: campaignId,
          client_id: user.id,
          contact_name: contact.name,
          contact_phone: contact.phone,
          campaign_name: campaign.name,
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          duration: activeSec,
          active_duration_seconds: activeSec,
          status,
          vapi_cost: vapiCost,
          transcript_json: transcriptJson,
          transcript: transcriptJson
            ? JSON.parse(transcriptJson).map(m => `${m.role === 'bot' ? 'בוט' : 'לקוח'}: ${m.text}`).join('\n')
            : null,
        });
      }

      // Update campaign counters
      const allContacts = await base44.entities.Contact.filter({ campaign_id: campaignId });
      const dialed = allContacts.filter(c => c.status !== 'pending').length;
      const answered = allContacts.filter(c => ['answered', 'interested', 'not_interested'].includes(c.status)).length;
      const interested = allContacts.filter(c => c.status === 'interested').length;
      await base44.entities.Campaign.update(campaignId, {
        dialed_contacts: dialed,
        answered_contacts: answered,
        actual_minutes: ((campaign.actual_minutes || 0) + totalSeconds / 60),
      });

      // Deduct minutes from client balance
      await deductMinutes({ client_id: user.id, active_duration_seconds: totalSeconds, campaign_id: campaignId, vapi_cost: totalVapiCost });

      return { processed: pendingContacts.length, interested };
    },
    onSuccess: (result) => {
      setSimulating(false);
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaignContacts', campaignId] });
      if (result) toast({ title: `סימולציה הושלמה ✅`, description: `${result.processed} שיחות · ${result.interested} מעוניינים` });
    },
    onError: () => {
      setSimulating(false);
      toast({ title: 'שגיאה בסימולציה', variant: 'destructive' });
    }
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!campaign) return <div className="text-center py-12">קמפיין לא נמצא</div>;

  const progressPercent = campaign.total_contacts > 0 ? ((campaign.dialed_contacts || 0) / campaign.total_contacts) * 100 : 0;
  const answerRate = (campaign.dialed_contacts || 0) > 0 ? Math.round(((campaign.answered_contacts || 0) / campaign.dialed_contacts) * 100) : 0;
  const pending = contacts.filter(c => c.status === 'pending').length;
  const statusLabels = { pending: 'ממתין', calling: 'בשיחה', answered: 'ענה', voicemail: 'תא קולי', no_answer: 'לא ענה', interested: 'מעוניין', not_interested: 'לא מעוניין' };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}><ArrowRight className="w-5 h-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <Badge variant={campaign.status === 'active' ? 'default' : campaign.status === 'completed' ? 'secondary' : 'outline'}>
              {campaign.status === 'active' ? 'פעיל' : campaign.status === 'completed' ? 'הושלם' : campaign.status === 'paused' ? 'מושהה' : 'טיוטה'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">תסריט: {script?.name || 'לא הוגדר'}</p>
        </div>
        <div className="flex gap-2">
          {campaign.status !== 'completed' && (
            <>
              {campaign.status === 'active' ? (
                <>
                  <Button variant="outline" onClick={() => updateStatus.mutate('paused')}><Pause className="w-4 h-4 ml-2" /> השהה</Button>
                  <Button variant="destructive" onClick={() => updateStatus.mutate('completed')}><Square className="w-4 h-4 ml-2" /> עצור</Button>
                </>
              ) : (
                <Button onClick={() => updateStatus.mutate('active')}><Play className="w-4 h-4 ml-2" /> הפעל</Button>
              )}
              <Button variant="outline" onClick={() => simulateCalls.mutate()} disabled={simulating || pending === 0}>
                <Zap className="w-4 h-4 ml-2" /> {simulating ? 'מבצע...' : 'סימולציה'}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium">התקדמות הקמפיין</span>
            <span className="text-sm text-muted-foreground">{campaign.dialed_contacts || 0} / {campaign.total_contacts || 0}</span>
          </div>
          <Progress value={progressPercent} className="h-4" />
          <p className="text-sm text-muted-foreground mt-2">{pending} אנשי קשר ממתינים</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="סה״כ אנשי קשר" value={campaign.total_contacts || 0} icon={Users} />
        <StatsCard title="חויגו" value={campaign.dialed_contacts || 0} icon={PhoneCall} />
        <StatsCard title="ענו" value={campaign.answered_contacts || 0} icon={UserCheck} color="gold" />
        <StatsCard title="אחוז מענה" value={`${answerRate}%`} icon={Clock} />
      </div>

      <Card>
        <CardHeader><CardTitle>אנשי קשר</CardTitle></CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">אין אנשי קשר בקמפיין</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>ניסיונות</TableHead>
                  <TableHead>משך</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.slice(0, 20).map(contact => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="font-mono" dir="ltr">{contact.phone}</TableCell>
                    <TableCell>
                      <Badge variant={contact.status === 'interested' ? 'default' : contact.status === 'not_interested' ? 'destructive' : 'outline'}>
                        {statusLabels[contact.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{contact.attempts || 0}</TableCell>
                    <TableCell>{contact.duration ? `${Math.floor(contact.duration / 60)}:${String(contact.duration % 60).padStart(2, '0')}` : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {contacts.length > 20 && <p className="text-center text-sm text-muted-foreground mt-4">מציג 20 מתוך {contacts.length}</p>}
        </CardContent>
      </Card>
    </div>
  );
}