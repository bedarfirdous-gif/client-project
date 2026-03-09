import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Calendar, Clock, Users, Check, X, RefreshCw, UserCheck, UserX, 
  CheckCircle, XCircle, Coffee, LogIn, LogOut, Save, AlertCircle, Building2, 
  AlertTriangle, Timer
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function DailyAttendancePage() {
  const { api, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [changes, setChanges] = useState({});
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');

  // Fetch stores on mount
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const storesData = await api('/api/stores');
        setStores(storesData);
        // Set default store from user's store_ids or first available store
        if (user?.store_ids?.length > 0) {
          setSelectedStore(user.store_ids[0]);
        } else if (storesData.length > 0) {
          setSelectedStore(storesData[0].id);
        }
      } catch (err) {
        console.error('Failed to load stores:', err);
      }
    };
    fetchStores();
  }, [api, user]);

  useEffect(() => {
    if (selectedStore) {
      fetchData();
    }
  }, [selectedDate, selectedStore]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empData, attData] = await Promise.all([
        api(`/api/employees?store_id=${selectedStore}`),
        api(`/api/attendance?date=${selectedDate}&store_id=${selectedStore}`)
      ]);
      setEmployees(empData.filter(e => e.is_active !== false));
      
      const attMap = {};
      attData.forEach(a => {
        attMap[a.employee_id] = a;
      });
      setAttendance(attMap);
      setChanges({});
    } catch (err) {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const updateLocalStatus = (employeeId, status) => {
    setChanges(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        status,
        check_in: status === 'present' ? (prev[employeeId]?.check_in || '09:00') : null,
        check_out: status === 'present' ? (prev[employeeId]?.check_out || '18:00') : null
      }
    }));
  };

  const updateCheckTime = (employeeId, field, value) => {
    setChanges(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value
      }
    }));
  };

  const getEmployeeStatus = (empId) => {
    if (changes[empId]?.status) return changes[empId].status;
    return attendance[empId]?.status || null;
  };

  const getCheckTime = (empId, field) => {
    if (changes[empId]?.[field] !== undefined) return changes[empId][field] || '';
    return attendance[empId]?.[field] || '';
  };

  const markAllPresent = () => {
    const newChanges = {};
    employees.forEach(emp => {
      if (!getEmployeeStatus(emp.id)) {
        newChanges[emp.id] = {
          status: 'present',
          check_in: '09:00',
          check_out: '18:00'
        };
      }
    });
    setChanges(prev => ({ ...prev, ...newChanges }));
    toast.success(`Marked ${Object.keys(newChanges).length} employees as present`);
  };

  const saveAllAttendance = async () => {
    if (Object.keys(changes).length === 0) {
      toast.info('No changes to save');
      return;
    }

    if (!selectedStore) {
      toast.error('Please select a store first');
      return;
    }

    setSaving(true);
    try {
      const promises = Object.entries(changes).map(([empId, data]) => 
        api('/api/attendance', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: empId,
            store_id: selectedStore,
            date: selectedDate,
            status: data.status,
            in_time: data.check_in,
            out_time: data.check_out
          })
        })
      );
      
      await Promise.all(promises);
      toast.success(`Saved attendance for ${Object.keys(changes).length} employees`);
      fetchData();
    } catch (err) {
      toast.error('Failed to save attendance: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Calculate summary stats
  const presentCount = employees.filter(e => getEmployeeStatus(e.id) === 'present').length;
  const absentCount = employees.filter(e => getEmployeeStatus(e.id) === 'absent').length;
  const leaveCount = employees.filter(e => getEmployeeStatus(e.id) === 'leave').length;
  const unmarkedCount = employees.filter(e => !getEmployeeStatus(e.id)).length;
  const hasChanges = Object.keys(changes).length > 0;
  
  // Calculate total late hours from attendance data
  const totalLateHours = Object.values(attendance).reduce((sum, att) => sum + (att?.late_hours || 0), 0);
  const lateEmployeesCount = Object.values(attendance).filter(att => (att?.late_hours || 0) > 0).length;

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const dateDisplay = new Date(selectedDate).toLocaleDateString('en-IN', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="daily-attendance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Daily Attendance
          </h1>
          <p className="text-muted-foreground">Mark attendance for all employees</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-44" data-testid="store-selector">
              <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select Store" />
            </SelectTrigger>
            <SelectContent>
              {stores.map(store => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Date Banner */}
      <Card className={`border-2 ${isToday ? 'border-primary bg-primary/5' : 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${isToday ? 'bg-primary' : 'bg-amber-500'}`}>
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-lg">{dateDisplay}</p>
                <p className="text-sm text-muted-foreground">
                  {isToday ? 'Today\'s Attendance' : 'Historical Record'}
                </p>
              </div>
            </div>
            {isToday && (
              <Badge className="bg-primary text-white">TODAY</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Present</p>
                <p className="text-2xl font-bold text-green-600">{presentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500">
                <UserX className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absent</p>
                <p className="text-2xl font-bold text-red-600">{absentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500">
                <Coffee className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">On Leave</p>
                <p className="text-2xl font-bold text-amber-600">{leaveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Late ({lateEmployeesCount})</p>
                <p className="text-2xl font-bold text-orange-600">{totalLateHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unmarked</p>
                <p className="text-2xl font-bold text-gray-600">{unmarkedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg">
        <Button onClick={markAllPresent} variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
          <CheckCircle className="w-4 h-4 mr-2" /> Mark All Present
        </Button>
        <div className="flex-1" />
        {hasChanges && (
          <Badge variant="secondary" className="self-center">
            {Object.keys(changes).length} unsaved changes
          </Badge>
        )}
        <Button 
          onClick={saveAllAttendance} 
          disabled={!hasChanges || saving}
          className="bg-primary"
        >
          <Save className="w-4 h-4 mr-2" /> 
          {saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>

      {/* Employee Attendance Grid */}
      <div className="grid gap-3">
        {employees.map((emp, idx) => {
          const status = getEmployeeStatus(emp.id);
          const checkIn = getCheckTime(emp.id, 'check_in');
          const checkOut = getCheckTime(emp.id, 'check_out');
          const hasChange = changes[emp.id] !== undefined;
          const lateHours = attendance[emp.id]?.late_hours || 0;
          const shiftStart = emp.shift_start_time || attendance[emp.id]?.shift_start_time || '09:00';
          const isLate = lateHours > 0;
          
          return (
            <Card 
              key={emp.id} 
              className={`transition-all ${hasChange ? 'ring-2 ring-primary ring-offset-2' : ''} ${
                status === 'present' ? (isLate ? 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20' : 'border-green-200 bg-green-50/50 dark:bg-green-950/20') :
                status === 'absent' ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' :
                status === 'leave' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20' :
                ''
              }`}
            >
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Employee Info */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      status === 'present' ? (isLate ? 'bg-orange-500' : 'bg-green-500') :
                      status === 'absent' ? 'bg-red-500' :
                      status === 'leave' ? 'bg-amber-500' :
                      'bg-gray-400'
                    }`}>
                      {emp.name?.charAt(0)?.toUpperCase() || '#'}
                    </div>
                    <div>
                      <p className="font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.department || 'General'} 
                        <span className="ml-2 text-gray-400">Shift: {shiftStart}</span>
                      </p>
                    </div>
                  </div>

                  {/* Status Buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={status === 'present' ? 'default' : 'outline'}
                      className={status === 'present' ? 'bg-green-600 hover:bg-green-700' : 'border-green-300 text-green-700 hover:bg-green-50'}
                      onClick={() => updateLocalStatus(emp.id, 'present')}
                    >
                      <Check className="w-4 h-4 mr-1" /> Present
                    </Button>
                    <Button
                      size="sm"
                      variant={status === 'absent' ? 'default' : 'outline'}
                      className={status === 'absent' ? 'bg-red-600 hover:bg-red-700' : 'border-red-300 text-red-700 hover:bg-red-50'}
                      onClick={() => updateLocalStatus(emp.id, 'absent')}
                    >
                      <X className="w-4 h-4 mr-1" /> Absent
                    </Button>
                    <Button
                      size="sm"
                      variant={status === 'leave' ? 'default' : 'outline'}
                      className={status === 'leave' ? 'bg-amber-600 hover:bg-amber-700' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}
                      onClick={() => updateLocalStatus(emp.id, 'leave')}
                    >
                      <Coffee className="w-4 h-4 mr-1" /> Leave
                    </Button>
                  </div>

                  {/* Check-in/Check-out Times (only for present) */}
                  {status === 'present' && (
                    <div className="flex items-center gap-4 ml-auto">
                      <div className="flex items-center gap-2">
                        <LogIn className="w-4 h-4 text-green-600" />
                        <Input
                          type="time"
                          value={checkIn}
                          onChange={(e) => updateCheckTime(emp.id, 'check_in', e.target.value)}
                          className="w-28 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <LogOut className="w-4 h-4 text-red-600" />
                        <Input
                          type="time"
                          value={checkOut}
                          onChange={(e) => updateCheckTime(emp.id, 'check_out', e.target.value)}
                          className="w-28 h-8 text-sm"
                        />
                      </div>
                      {/* Late Hours Badge */}
                      {isLate && (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                          <Timer className="w-3 h-3 mr-1" />
                          Late: {lateHours.toFixed(1)}h
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Status Badge for marked employees */}
                  {status && (
                    <Badge 
                      className={`ml-auto ${
                        status === 'present' ? 'bg-green-100 text-green-700' :
                        status === 'absent' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {employees.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Employees Found</h3>
            <p className="text-muted-foreground">Add employees to start marking attendance</p>
          </CardContent>
        </Card>
      )}

      {/* Footer Info */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Total Employees: {employees.length} | Attendance Rate: {employees.length > 0 ? Math.round((presentCount / employees.length) * 100) : 0}%</p>
      </div>
    </div>
  );
}
