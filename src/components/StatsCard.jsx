import { Card, CardContent } from '@/components/ui/card';

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'primary' }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {Icon && (
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color === 'gold' ? 'bg-accent/20' : 'bg-primary/10'}`}>
              <Icon className={`w-6 h-6 ${color === 'gold' ? 'text-amber-500' : 'text-primary'}`} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}