import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Calendar, Clock, Save, X, Users, RefreshCw, FileSpreadsheet, Building2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', color: 'bg-emerald-500', textColor: 'text-white' },
  { value: 'absent', label: 'Absent', color: 'bg-red-500', textColor: 'text-white' },
  { value: 'half-day', label: 'Half Day', color: 'bg-lime-400', textColor: 'text-gray-800' },
  { value: 'late', label: 'Late', color: 'bg-orange-500', textColor: 'text-white' },
  { value: 'leave', label: 'Leave', color: 'bg-purple-500', textColor: 'text-white' },
  { value: 'holiday', label: 'Holiday', color: 'bg-blue-500', textColor: 'text-white' },
  { value: 'week-off', label: 'Week Off', color: 'bg-gray-400', textColor: 'text-white' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MonthlyAttendanceSheet() {
  const { api, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');

  useEffect(() => {
    fetchStoresAndEmployees();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchEmployeesForStore();
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedEmployee) {
      generateMonthDays();
      fetchExistingAttendance();
    }
  }, [selectedEmployee, selectedMonth, selectedYear]);

  const fetchStoresAndEmployees = async () => {
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
      toast.error('Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeesForStore = async () => {
    try {
      const data = await api(`/api/employees?store_id=${selectedStore}`);
      setEmployees(data.filter(e => e.is_active !== false));
      setSelectedEmployee(''); // Reset employee selection when store changes
    } catch (err) {
      toast.error('Failed to load employees');
    }
  };

  const fetchExistingAttendance = async () => {
    if (!selectedEmployee) return;
    
    try {
      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${getDaysInMonth()}`;
      const data = await api(`/api/attendance?employee_id=${selectedEmployee}&start_date=${startDate}&end_date=${endDate}`);
      
      // Merge existing attendance with generated days
      setAttendanceData(prev => {
        return prev.map(day => {
          const existing = data.find(a => a.date === day.date);
          if (existing) {
            return {
              ...day,
              status: existing.status,
              inTime: existing.check_in || '09:30',
              outTime: existing.check_out || '18:30',
              otHours: existing.ot_hours || 0
            };
          }
          return day;
        });
      });
    } catch (err) {
      // Ignore errors, use generated defaults
    }
  };

  const getDaysInMonth = () => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  };

  const generateMonthDays = () => {
    const days = [];
    const daysInMonth = getDaysInMonth();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0; // Sunday
      
      days.push({
        date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        dayNum: day,
        dayName: DAYS[dayOfWeek],
        status: isWeekend ? 'week-off' : 'present',
        inTime: isWeekend ? '' : '09:30',
        outTime: isWeekend ? '' : '18:30',
        otHours: 0,
        isWeekend
      });
    }
    
    setAttendanceData(days);
  };

  const updateDayAttendance = (index, field, value) => {
    setAttendanceData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Clear times if status is week-off, holiday, absent, or leave
      if (field === 'status' && ['week-off', 'holiday', 'absent', 'leave'].includes(value)) {
        updated[index].inTime = '';
        updated[index].outTime = '';
      } else if (field === 'status' && ['present', 'half-day', 'late'].includes(value)) {
        updated[index].inTime = updated[index].inTime || '09:30';
        updated[index].outTime = updated[index].outTime || '18:30';
      }
      
      return updated;
    });
  };

  const saveAttendance = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    if (!selectedStore) {
      toast.error('Please select a store');
      return;
    }

    setSaving(true);
    try {
      const promises = attendanceData.map(day => 
        api('/api/attendance', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: selectedEmployee,
            store_id: selectedStore,
            date: day.date,
            status: day.status,
            in_time: day.inTime || null,
            out_time: day.outTime || null
          })
        })
      );
      
      await Promise.all(promises);
      toast.success(`Attendance saved for ${MONTHS[selectedMonth]} ${selectedYear}`);
      setShowModal(false);
    } catch (err) {
      toast.error('Failed to save attendance: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusStyle = (status) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return option ? `${option.color} ${option.textColor}` : 'bg-gray-200';
  };

  const openCreateModal = () => {
    setSelectedEmployee('');
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
    setAttendanceData([]);
    // Re-fetch employees for currently selected store when modal opens
    if (selectedStore) {
      fetchEmployeesForStore();
    }
    setShowModal(true);
  };

  // Calculate summary
  const presentDays = attendanceData.filter(d => d.status === 'present').length;
  const absentDays = attendanceData.filter(d => d.status === 'absent').length;
  const leaveDays = attendanceData.filter(d => d.status === 'leave').length;
  const weekOffDays = attendanceData.filter(d => d.status === 'week-off').length;

  return (
    <div className="space-y-6" data-testid="monthly-attendance-sheet">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            Monthly Attendance Sheet
          </h1>
          <p className="text-muted-foreground">Create and manage monthly attendance records</p>
        </div>
        <Button onClick={openCreateModal} className="bg-primary">
          <Calendar className="w-4 h-4 mr-2" /> Create Monthly Attendance
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{presentDays}</p>
            <p className="text-sm text-emerald-700">Present Days</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-red-600">{absentDays}</p>
            <p className="text-sm text-red-700">Absent Days</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{leaveDays}</p>
            <p className="text-sm text-purple-700">Leave Days</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-gray-50 dark:bg-gray-950/20">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-gray-600">{weekOffDays}</p>
            <p className="text-sm text-gray-700">Week Off</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Monthly Attendance Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-amber-50 dark:bg-amber-950/20">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-bold">Create Monthly Attendance</DialogTitle>
            <p className="text-sm text-muted-foreground">Enter attendance for the entire month</p>
          </DialogHeader>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-4 py-4 border-b">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Store *</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-44 bg-white">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Employee *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={!selectedStore}>
                <SelectTrigger className="w-52 bg-white">
                  <SelectValue placeholder={selectedStore ? "Select employee" : "Select store first"} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Month</Label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-40 bg-blue-500 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, idx) => (
                    <SelectItem key={idx} value={String(idx)}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Year</Label>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-32 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status Legend */}
          <div className="flex flex-wrap gap-3 py-3 border-b">
            {STATUS_OPTIONS.map(opt => (
              <div key={opt.value} className="flex items-center gap-1.5">
                <div className={`w-4 h-4 rounded ${opt.color}`}></div>
                <span className="text-xs font-medium">{opt.label}</span>
              </div>
            ))}
          </div>

          {/* Attendance Table */}
          <div className="flex-1 overflow-auto min-h-0">
            {selectedEmployee ? (
              <table className="w-full">
                <thead className="sticky top-0 bg-amber-100 dark:bg-amber-900/40">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-semibold w-16">Date</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold w-16">Day</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold w-40">Status</th>
                    <th className="px-3 py-2 text-center text-sm font-semibold w-32">In Time</th>
                    <th className="px-3 py-2 text-center text-sm font-semibold w-32">Out Time</th>
                    <th className="px-3 py-2 text-center text-sm font-semibold w-20">OT Hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map((day, idx) => (
                    <tr 
                      key={day.date} 
                      className={`border-b ${day.isWeekend ? 'bg-gray-100 dark:bg-gray-800/30' : 'bg-white dark:bg-gray-900/20'}`}
                    >
                      <td className="px-3 py-2 font-mono font-semibold">{String(day.dayNum).padStart(2, '0')}</td>
                      <td className="px-3 py-2 font-medium">{day.dayName}</td>
                      <td className="px-3 py-2">
                        <Select 
                          value={day.status} 
                          onValueChange={(v) => updateDayAttendance(idx, 'status', v)}
                        >
                          <SelectTrigger className={`w-32 h-8 ${getStatusStyle(day.status)} border-0`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded ${opt.color}`}></div>
                                  {opt.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        {['present', 'half-day', 'late'].includes(day.status) ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="time"
                              value={day.inTime}
                              onChange={(e) => updateDayAttendance(idx, 'inTime', e.target.value)}
                              className="w-28 h-8 text-center bg-white border border-gray-300"
                            />
                            <Clock className="w-4 h-4 text-gray-400" />
                          </div>
                        ) : (
                          <span className="text-gray-400 text-center block">--:--</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {['present', 'half-day', 'late'].includes(day.status) ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="time"
                              value={day.outTime}
                              onChange={(e) => updateDayAttendance(idx, 'outTime', e.target.value)}
                              className="w-28 h-8 text-center bg-white border border-gray-300"
                            />
                            <Clock className="w-4 h-4 text-gray-400" />
                          </div>
                        ) : (
                          <span className="text-gray-400 text-center block">--:--</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={day.otHours}
                          onChange={(e) => updateDayAttendance(idx, 'otHours', parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-center bg-white border border-gray-300 mx-auto"
                          min="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-gray-500">Select an employee to view/edit attendance</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveAttendance} 
              disabled={!selectedEmployee || saving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info */}
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Monthly Attendance Sheets</h3>
          <p className="text-muted-foreground mb-4">
            Click "Create Monthly Attendance" to enter attendance for an employee for the entire month
          </p>
          <Button onClick={openCreateModal}>
            <Calendar className="w-4 h-4 mr-2" /> Get Started
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
