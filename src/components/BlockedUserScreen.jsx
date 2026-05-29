import { ShieldOff, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function BlockedUserScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md space-y-6">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <ShieldOff className="w-10 h-10 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">החשבון חסום</h1>
          <p className="text-muted-foreground mt-2">
            הגישה לחשבונך הוגבלה. אנא פנה אל מנהל המערכת לקבלת סיוע.
          </p>
        </div>
        <Button variant="outline" onClick={() => base44.auth.logout()} className="gap-2">
          <LogOut className="w-4 h-4" /> התנתקות
        </Button>
      </div>
    </div>
  );
}