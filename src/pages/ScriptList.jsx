import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

export default function ScriptList() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: scripts = [], isLoading } = useQuery({
    queryKey: ['scripts'],
    queryFn: () => base44.entities.Script.list('-created_date')
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.filter({ role: 'user' })
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ['scriptNodes'],
    queryFn: () => base44.entities.ScriptNode.list()
  });

  const deleteScript = useMutation({
    mutationFn: async (id) => {
      const scriptNodes = nodes.filter(n => n.script_id === id);
      for (const node of scriptNodes) {
        await base44.entities.ScriptNode.delete(node.id);
      }
      await base44.entities.Script.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      queryClient.invalidateQueries({ queryKey: ['scriptNodes'] });
      toast({ title: 'התסריט נמחק בהצלחה' });
    }
  });

  const getClientName = (clientId) => {
    const user = users.find(u => u.id === clientId);
    return user ? (user.full_name || user.email) : 'לא הוקצה';
  };

  const getNodeCount = (scriptId) => nodes.filter(n => n.script_id === scriptId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">תסריטי שיחה</h1>
          <p className="text-muted-foreground mt-1">{scripts.length} תסריטים במערכת</p>
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
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">אין תסריטים עדיין</p>
              <Button className="mt-4" onClick={() => navigate('/admin/scripts/new')}>צור תסריט ראשון</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>תיאור</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>צמתים</TableHead>
                  <TableHead>לקוח מוקצה</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scripts.map(script => (
                  <TableRow key={script.id}>
                    <TableCell className="font-medium">{script.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{script.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={script.status === 'active' ? 'default' : 'secondary'}>
                        {script.status === 'active' ? 'פעיל' : 'טיוטה'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getNodeCount(script.id)}</TableCell>
                    <TableCell>{getClientName(script.assigned_client_id)}</TableCell>
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
                              <AlertDialogDescription>האם אתה בטוח שברצונך למחוק את התסריט "{script.name}"? פעולה זו בלתי הפיכה.</AlertDialogDescription>
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