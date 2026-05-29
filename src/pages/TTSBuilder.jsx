import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Mic, Play, Trash2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

export default function TTSBuilder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', text: '', language: 'he', voice: 'female' });
  const [generating, setGenerating] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['audioAssets'],
    queryFn: () => base44.entities.AudioAsset.list('-created_date')
  });

  const generateTTS = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      // Mock TTS generation - in production connect to Google TTS
      const mockUrl = `https://example.com/tts/${Date.now()}.mp3`;
      await base44.entities.AudioAsset.create({
        ...form,
        file_url: mockUrl
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audioAssets'] });
      setForm({ name: '', text: '', language: 'he', voice: 'female' });
      setGenerating(false);
      toast({ title: 'קובץ השמע נוצר בהצלחה', description: '(סימולציה - בעתיד יחובר ל-Google TTS)' });
    },
    onError: () => {
      setGenerating(false);
      toast({ title: 'שגיאה ביצירת קובץ שמע', variant: 'destructive' });
    }
  });

  const deleteAsset = useMutation({
    mutationFn: (id) => base44.entities.AudioAsset.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audioAssets'] });
      toast({ title: 'קובץ השמע נמחק' });
    }
  });

  const playAudio = (asset) => {
    // Mock play - in production would play actual audio
    setPlayingId(asset.id);
    toast({ title: 'מנגן...', description: asset.text.substring(0, 50) + '...' });
    setTimeout(() => setPlayingId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">בונה קול (TTS)</h1>
        <p className="text-muted-foreground mt-1">יצירת קבצי שמע מטקסט</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="flex items-center gap-2"><Mic className="w-5 h-5" /> הפקת שמע חדש</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>שם קובץ</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="פתיחת שיחה" />
            </div>
            <div className="space-y-2">
              <Label>טקסט</Label>
              <Textarea value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} placeholder="שלום, אני מתקשר מחברת..." rows={4} />
            </div>
            <div className="space-y-2">
              <Label>שפה</Label>
              <Select value={form.language} onValueChange={v => setForm({ ...form, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="he">עברית</SelectItem>
                  <SelectItem value="ar">ערבית</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>קול</Label>
              <Select value={form.voice} onValueChange={v => setForm({ ...form, voice: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">אישה</SelectItem>
                  <SelectItem value="male">גבר</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gap-2" onClick={() => generateTTS.mutate()} disabled={!form.name || !form.text || generating}>
              <Volume2 className="w-4 h-4" /> {generating ? 'מפיק...' : 'הפק קול'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">* כרגע סימולציה, בעתיד יחובר ל-Google TTS</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>קבצי שמע קיימים</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
            ) : assets.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">אין קבצי שמע עדיין</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>טקסט</TableHead>
                    <TableHead>שפה</TableHead>
                    <TableHead>קול</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map(asset => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">{asset.text}</TableCell>
                      <TableCell><Badge variant="outline">{asset.language === 'he' ? 'עברית' : 'ערבית'}</Badge></TableCell>
                      <TableCell>{asset.voice === 'female' ? 'אישה' : 'גבר'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => playAudio(asset)} disabled={playingId === asset.id}>
                            <Play className={`w-4 h-4 ${playingId === asset.id ? 'animate-pulse' : ''}`} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>מחיקת קובץ שמע</AlertDialogTitle>
                                <AlertDialogDescription>האם אתה בטוח?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteAsset.mutate(asset.id)} className="bg-destructive">מחק</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}