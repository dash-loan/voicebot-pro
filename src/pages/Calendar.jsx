import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, CalendarDays, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday
} from 'date-fns';
import { he } from 'date-fns/locale';

const STATUS_COLORS = {
  active:       'bg-green-500 text-white',
  paused:       'bg-yellow-500 text-white',
  completed:    'bg-slate-400 text-white',
  draft:        'bg-blue-400 text-white',
  pending_vapi: 'bg-purple-400 text-white',
};

const STATUS_LABELS = {
  active: 'פעיל', paused: 'עצור', completed: 'הושלם', draft: 'טיוטה', pending_vapi: 'ממתין',
};

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = user?.role === 'admin';

  const { data: campaigns = [] } = useQuery({
    queryKey: ['calendarCampaigns', user?.id, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.Campaign.list()
      : base44.entities.Campaign.filter({ client_id: user?.id }),
    enabled: !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.filter({ role: 'user' }),
    enabled: isAdmin,
  });

  const getClientName = (id) => {
    const u = users.find(u => u.id === id);
    return u?.full_name || u?.email || '';
  };

  // Campaign to date mapping (use start_date or created_date)
  const getCampaignsForDay = (day) =>
    campaigns.filter(c => {
      const dateStr = c.start_date || c.created_date;
      if (!dateStr) return false;
      try { return isSameDay(parseISO(dateStr), day); } catch { return false; }
    });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  const selectedDayCampaigns = selectedDay ? getCampaignsForDay(selectedDay) : [];

  // Upcoming campaigns (next 14 days)
  const now = new Date();
  const upcoming = campaigns
    .filter(c => {
      const d = c.start_date || c.created_date;
      if (!d) return false;
      try {
        const dt = parseISO(d);
        return dt >= now;
      } catch { return false; }
    })
    .sort((a, b) => {
      const da = parseISO(a.start_date || a.created_date);
      const db = parseISO(b.start_date || b.created_date);
      return da - db;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="w-8 h-8 text-primary" /> לוח תכנון קמפיינים
          </h1>
          <p className="text-muted-foreground mt-1">{campaigns.length} קמפיינים בסך הכל</p>
        </div>
        <Link to="/campaigns">
          <Button className="gap-2"><Plus className="w-4 h-4" /> קמפיין חדש</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronRight className="w-5 h-5" />
              </Button>
              <h2 className="text-xl font-bold">
                {format(currentMonth, 'MMMM yyyy', { locale: he })}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day names */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
              ))}
            </div>
            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map(day => {
                const dayCampaigns = getCampaignsForDay(day);
                const inMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const todayClass = isToday(day) ? 'ring-2 ring-primary' : '';
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(isSameDay(selectedDay, day) ? null : day)}
                    className={`min-h-[70px] p-1 rounded-lg cursor-pointer transition-colors border
                      ${inMonth ? 'bg-card hover:bg-muted/50' : 'bg-muted/20 opacity-50'}
                      ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent'}
                      ${todayClass}
                    `}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-primary font-bold' : inMonth ? '' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayCampaigns.slice(0, 2).map(c => (
                        <div key={c.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${STATUS_COLORS[c.status] || 'bg-primary/20 text-primary'}`}>
                          {c.name}
                        </div>
                      ))}
                      {dayCampaigns.length > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayCampaigns.length - 2} עוד</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5 text-xs">
                  <div className={`w-3 h-3 rounded ${STATUS_COLORS[k]}`} />
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Selected day details */}
          {selectedDay && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {format(selectedDay, 'EEEE, d MMMM', { locale: he })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayCampaigns.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">אין קמפיינים ביום זה</p>
                    <Link to="/campaigns">
                      <Button size="sm" variant="outline" className="mt-2 gap-1">
                        <Plus className="w-3 h-3" /> צור קמפיין
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDayCampaigns.map(c => (
                      <Link key={c.id} to={`/campaigns/${c.id}`} className="block">
                        <div className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-medium text-sm">{c.name}</p>
                            <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                              {STATUS_LABELS[c.status]}
                            </Badge>
                          </div>
                          {isAdmin && <p className="text-xs text-muted-foreground">{getClientName(c.client_id)}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {c.dialing_start} – {c.dialing_end} · {c.total_contacts || 0} אנשי קשר
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">קמפיינים קרובים</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">אין קמפיינים מתוכננים</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(c => {
                    const dateStr = c.start_date || c.created_date;
                    return (
                      <Link key={c.id} to={`/campaigns/${c.id}`} className="block">
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{format(parseISO(dateStr), 'd')}</span>
                            <span className="text-[9px] text-muted-foreground">{format(parseISO(dateStr), 'MMM', { locale: he })}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{STATUS_LABELS[c.status]}</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}