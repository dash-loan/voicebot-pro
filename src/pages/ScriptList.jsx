import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, FileText, Bot, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

export default function ScriptList() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: scripts = [], isLoading } = useQuery({
    queryKey: ['scripts'],
    queryFn: () => base44.entities.Script.list('-created_date'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.filter({ role: 'user' }),
  });

  const deleteScript = useMutation({
    mutationFn: (id) => base44.entities.Script.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      toast({ title: 'התסריט נמחק' });
    },
  });

  const getClientName = (clientId) => {
    const user = users.find(u => u.id === clientId);
    return user ? (user.full_name || user.email) : null;
  };

  const langLabel = { he: '🇮🇱 עברית', ar: '🇸🇦 ערבית' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">תסריטי שיחה</h1>
          <p className="text-muted-foreground mt-1">{scripts.length} תסריטים · כל תסריט = Vapi Assistant</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/admin/scripts/new')}>
          <Plus className="w-4 h-4" /> צור תסריט חדש
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
          ) : scripts.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-medium text-muted-foreground">אין תסריטים עדיין</p>
              <p className="text-sm text-muted-foreground mt-2">כל תסריט ייצור Vapi Assistant שמדבר עם הלקוחות</p>
              <Button className="mt-6" onClick={() => navigate('/admin/scripts/new')}>
                <Plus className="w-4 h-4 ml-2" /> צור תסריט ראשון
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם תסריט</TableHead>
                  <TableHead>שפה</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>Vapi Assistant</TableHead>
                  <TableHead>לקוח מוקצה</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scripts.map(script => (
                  <TableRow key={script.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-primary/50" />
                        <span className="font-medium">{script.name}</span>
                      </div>
                      {script.description && <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{script.description}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{langLabel[script.language] || script.language || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={script.status === 'active' ? 'default' : 'secondary'}>
                        {script.status === 'active' ? 'פעיל' : 'טיוטה'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {script.vapi_assistant_id ? (
                        <div className="flex items-center gap-1.5 text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="font-mono text-xs">{script.vapi_assistant_id.slice(0, 12)}...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-yellow-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs">לא נוצר ב-Vapi</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getClientName(script.assigned_client_id) || <span className="italic">כל הלקוחות</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/admin/scripts/${script.id}`)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>מחיקת תסריט</AlertDialogTitle>
                              <AlertDialogDescription>
                                האם למחוק את "{script.name}"? פעולה זו לא תמחק את ה-Assistant ב-Vapi עצמו.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteScript.mutate(script.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">מחק</AlertDialogAction>
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
  );
}