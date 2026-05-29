import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Save, Plus, Trash2, ArrowRight, CheckCircle, PlayCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

export default function ScriptBuilder() {
  const { scriptId } = useParams();
  const isNew = scriptId === 'new';
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [script, setScript] = useState({ name: '', description: '', status: 'draft', assigned_client_id: '' });
  const [nodes, setNodes] = useState([]);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [nodeForm, setNodeForm] = useState({ node_label: '', text: '', is_start: false, is_end: false, yes_next: '', no_next: '', no_answer_next: '', audio_asset_id: '' });

  const { data: existingScript } = useQuery({
    queryKey: ['script', scriptId],
    queryFn: () => base44.entities.Script.get(scriptId),
    enabled: !isNew
  });

  const { data: existingNodes = [] } = useQuery({
    queryKey: ['scriptNodes', scriptId],
    queryFn: () => base44.entities.ScriptNode.filter({ script_id: scriptId }),
    enabled: !isNew
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.filter({ role: 'user' })
  });

  const { data: audioAssets = [] } = useQuery({
    queryKey: ['audioAssets'],
    queryFn: () => base44.entities.AudioAsset.list()
  });

  useEffect(() => {
    if (existingScript) setScript(existingScript);
    if (existingNodes.length) setNodes(existingNodes);
  }, [existingScript, existingNodes]);

  const saveScript = useMutation({
    mutationFn: async () => {
      let id = scriptId;
      if (isNew) {
        const created = await base44.entities.Script.create(script);
        id = created.id;
      } else {
        await base44.entities.Script.update(scriptId, script);
      }
      // Save nodes
      const existingIds = existingNodes.map(n => n.id);
      const currentIds = nodes.filter(n => n.id).map(n => n.id);
      // Delete removed nodes
      for (const oldId of existingIds) {
        if (!currentIds.includes(oldId)) await base44.entities.ScriptNode.delete(oldId);
      }
      // Create/update nodes
      for (const node of nodes) {
        const nodeData = { ...node, script_id: id };
        delete nodeData.id;
        if (node.id && existingIds.includes(node.id)) {
          await base44.entities.ScriptNode.update(node.id, nodeData);
        } else {
          await base44.entities.ScriptNode.create(nodeData);
        }
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      queryClient.invalidateQueries({ queryKey: ['scriptNodes'] });
      toast({ title: 'התסריט נשמר בהצלחה' });
      if (isNew) navigate(`/admin/scripts/${id}`, { replace: true });
    }
  });

  const openNodeDialog = (node = null, index = null) => {
    if (node) {
      setEditingNode(index);
      setNodeForm({ ...node });
    } else {
      setEditingNode(null);
      setNodeForm({ node_label: `צומת ${nodes.length + 1}`, text: '', is_start: nodes.length === 0, is_end: false, yes_next: '', no_next: '', no_answer_next: '', audio_asset_id: '' });
    }
    setNodeDialogOpen(true);
  };

  const saveNode = () => {
    if (editingNode !== null) {
      const updated = [...nodes];
      updated[editingNode] = { ...updated[editingNode], ...nodeForm };
      setNodes(updated);
    } else {
      setNodes([...nodes, { ...nodeForm, order: nodes.length }]);
    }
    setNodeDialogOpen(false);
  };

  const deleteNode = (index) => {
    setNodes(nodes.filter((_, i) => i !== index));
  };

  const getNodeLabel = (nodeId) => {
    const node = nodes.find(n => (n.id || n.node_label) === nodeId);
    return node?.node_label || nodeId || '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/scripts')}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{isNew ? 'תסריט חדש' : 'עריכת תסריט'}</h1>
            <p className="text-muted-foreground mt-1">{nodes.length} צמתים</p>
          </div>
        </div>
        <Button onClick={() => saveScript.mutate()} disabled={!script.name || saveScript.isPending} className="gap-2">
          <Save className="w-4 h-4" /> {saveScript.isPending ? 'שומר...' : 'שמור'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>פרטי תסריט</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>שם התסריט</Label>
              <Input value={script.name} onChange={e => setScript({ ...script, name: e.target.value })} placeholder="תסריט מכירות" />
            </div>
            <div className="space-y-2">
              <Label>תיאור</Label>
              <Textarea value={script.description || ''} onChange={e => setScript({ ...script, description: e.target.value })} placeholder="תיאור קצר..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>לקוח מוקצה</Label>
              <Select value={script.assigned_client_id || ''} onValueChange={v => setScript({ ...script, assigned_client_id: v })}>
                <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>לא הוקצה</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>סטטוס פעיל</Label>
              <Switch checked={script.status === 'active'} onCheckedChange={v => setScript({ ...script, status: v ? 'active' : 'draft' })} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>צמתי שיחה</CardTitle>
            <Button size="sm" onClick={() => openNodeDialog()} className="gap-2"><Plus className="w-4 h-4" /> הוסף צומת</Button>
          </CardHeader>
          <CardContent>
            {nodes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>אין צמתים עדיין</p>
                <Button variant="outline" className="mt-4" onClick={() => openNodeDialog()}>הוסף צומת ראשון</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {nodes.map((node, idx) => (
                  <div key={idx} className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{node.node_label}</span>
                          {node.is_start && <Badge variant="outline" className="gap-1"><PlayCircle className="w-3 h-3" /> התחלה</Badge>}
                          {node.is_end && <Badge variant="outline" className="gap-1"><CheckCircle className="w-3 h-3" /> סיום</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{node.text}</p>
                        {!node.is_end && (
                          <div className="flex flex-wrap gap-4 text-xs">
                            <span><strong>כן →</strong> {getNodeLabel(node.yes_next)}</span>
                            <span><strong>לא →</strong> {getNodeLabel(node.no_next)}</span>
                            <span><strong>אין מענה →</strong> {getNodeLabel(node.no_answer_next)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mr-4">
                        <Button size="sm" variant="ghost" onClick={() => openNodeDialog(node, idx)}>עריכה</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteNode(idx)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={nodeDialogOpen} onOpenChange={setNodeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingNode !== null ? 'עריכת צומת' : 'צומת חדש'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>תווית צומת</Label>
              <Input value={nodeForm.node_label} onChange={e => setNodeForm({ ...nodeForm, node_label: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>טקסט שאלה/הצהרה</Label>
              <Textarea value={nodeForm.text} onChange={e => setNodeForm({ ...nodeForm, text: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>קובץ שמע (אופציונלי)</Label>
              <Select value={nodeForm.audio_asset_id || ''} onValueChange={v => setNodeForm({ ...nodeForm, audio_asset_id: v })}>
                <SelectTrigger><SelectValue placeholder="בחר קובץ שמע" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>ללא</SelectItem>
                  {audioAssets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={nodeForm.is_start} onCheckedChange={v => setNodeForm({ ...nodeForm, is_start: v })} />
                <Label>צומת התחלה</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={nodeForm.is_end} onCheckedChange={v => setNodeForm({ ...nodeForm, is_end: v })} />
                <Label>צומת סיום</Label>
              </div>
            </div>
            {!nodeForm.is_end && (
              <>
                <div className="space-y-2">
                  <Label>כן → עבור לצומת</Label>
                  <Select value={nodeForm.yes_next || ''} onValueChange={v => setNodeForm({ ...nodeForm, yes_next: v })}>
                    <SelectTrigger><SelectValue placeholder="בחר צומת" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>-</SelectItem>
                      {nodes.filter((_, i) => i !== editingNode).map((n, i) => <SelectItem key={i} value={n.id || n.node_label}>{n.node_label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>לא → עבור לצומת</Label>
                  <Select value={nodeForm.no_next || ''} onValueChange={v => setNodeForm({ ...nodeForm, no_next: v })}>
                    <SelectTrigger><SelectValue placeholder="בחר צומת" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>-</SelectItem>
                      {nodes.filter((_, i) => i !== editingNode).map((n, i) => <SelectItem key={i} value={n.id || n.node_label}>{n.node_label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>אין מענה/תא קולי → עבור לצומת</Label>
                  <Select value={nodeForm.no_answer_next || ''} onValueChange={v => setNodeForm({ ...nodeForm, no_answer_next: v })}>
                    <SelectTrigger><SelectValue placeholder="בחר צומת" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>-</SelectItem>
                      {nodes.filter((_, i) => i !== editingNode).map((n, i) => <SelectItem key={i} value={n.id || n.node_label}>{n.node_label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNodeDialogOpen(false)}>ביטול</Button>
            <Button onClick={saveNode} disabled={!nodeForm.node_label || !nodeForm.text}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}