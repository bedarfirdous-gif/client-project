import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Calendar, Clock, Users, Check, X, FileText, Download, Edit,
  ChevronLeft, ChevronRight, RefreshCw, UserCheck, UserX, CalendarDays, Building2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';

export default function AttendancePage() {
  const { api, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  
  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  // NOTE: Avoid null initial state to prevent a render pass where the modal content
  // briefly renders with "no employee" data (UI flash) before the real employee is set.
  // Use a stable empty object and treat "id == null" as not-selected.
  const [selectedEmployee, setSelectedEmployee] = useState({ id: null });
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const statusOptions = [
    { value: 'present', label: 'Present', color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'leave', label: 'Leave', color: 'bg-amber-100 text-amber-700 border-amber-300' },
    { value: 'half-day', label: 'Half Day', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  ];

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
      
      // Convert attendance array to object keyed by employee_id
      const attMap = {};
      attData.forEach(a => {
        attMap[a.employee_id] = a;
      });
      setAttendance(attMap);
    } catch (err) {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (employeeId, status) => {
    if (!selectedStore) {
      toast.error('Please select a store first');
      return;
    }
    
    try {
      await api('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          store_id: selectedStore,
          date: selectedDate,
          status: status,
          in_time: status === 'present' ? '09:00' : null,
          out_time: status === 'present' ? '18:00' : null
        })
      });
      toast.success('Attendance marked');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const viewEmployeeAttendance = async (employee) => {
    setSelectedEmployee(employee);
    setViewMonth(new Date().getMonth());
    setViewYear(new Date().getFullYear());
    await fetchMonthlyAttendance(employee.id, new Date().getMonth(), new Date().getFullYear());
    setShowViewModal(true);
  };

  const fetchMonthlyAttendance = async (empId, month, year) => {
    try {
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const data = await api(`/api/attendance?employee_id=${empId}&start_date=${startDate}&end_date=${endDate}`);
      setMonthlyAttendance(data);
    } catch (err) {
      setMonthlyAttendance([]);
    }
  };

  const changeViewMonth = async (direction) => {
    let newMonth = viewMonth + direction;
    let newYear = viewYear;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    
    setViewMonth(newMonth);
    setViewYear(newYear);
    await fetchMonthlyAttendance(selectedEmployee.id, newMonth, newYear);
  };

  // Calculate summary stats
  const presentCount = Object.values(attendance).filter(a => a.status === 'present').length;
  const absentCount = Object.values(attendance).filter(a => a.status === 'absent').length;
  const leaveCount = Object.values(attendance).filter(a => a.status === 'leave').length;
  const halfDayCount = Object.values(attendance).filter(a => a.status === 'half-day').length;

  // Calculate monthly stats
  const monthlyPresent = monthlyAttendance.filter(a => a.status === 'present').length;
  const monthlyAbsent = monthlyAttendance.filter(a => a.status === 'absent').length;
  const monthlyLeave = monthlyAttendance.filter(a => a.status === 'leave').length;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  
  // Get working days (excluding weekends)
  const getWorkingDays = () => {
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, viewMonth, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    }
    return count;
  };

  // Generate calendar grid
  const generateCalendar = () => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const days = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const att = monthlyAttendance.find(a => a.date === dateStr);
      const date = new Date(viewYear, viewMonth, day);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      
      days.push({
        day,
        status: att?.status || (isWeekend ? 'weekend' : null),
        isWeekend
      });
    }
    
    return days;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-green-500 text-white';
      case 'absent': return 'bg-red-500 text-white';
      case 'leave': return 'bg-amber-500 text-white';
      case 'half-day': return 'bg-blue-500 text-white';
      case 'weekend': return 'bg-gray-200 text-gray-500';
      default: return 'bg-gray-100 text-gray-400';
    }
  };

  const downloadPDF = () => {
    toast.success('Downloading attendance report...');
    // In a real app, this would generate and download a PDF
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="attendance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Attendance Management
          </h1>
          <p className="text-muted-foreground">Track and manage employee attendance</p>
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
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-400 to-green-600 shadow-lg">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Present</p>
                <p className="text-3xl font-bold text-green-600">{presentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-400 to-red-600 shadow-lg">
                <UserX className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="text-3xl font-bold text-red-600">{absentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leave</p>
                <p className="text-3xl font-bold text-amber-600">{leaveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Half Day</p>
                <p className="text-3xl font-bold text-blue-600">{halfDayCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Daily Attendance - {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp, idx) => {
                const att = attendance[emp.id];
                const currentStatus = att?.status || '';
                
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.employee_code || emp.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{emp.department || 'General'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <Select 
                          value={currentStatus} 
                          onValueChange={(v) => markAttendance(emp.id, v)}
                        >
                          <SelectTrigger className={`w-32 ${currentStatus ? statusOptions.find(s => s.value === currentStatus)?.color : ''}`}>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        {!currentStatus && (
                          <Button 
                            size="sm" 
                            onClick={() => markAttendance(emp.id, 'present')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-4 h-4 mr-1" /> Mark Present
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => viewEmployeeAttendance(emp)}
                        >
                          <CalendarDays className="w-4 h-4 mr-1" /> View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Attendance Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              View Attendance - {selectedEmployee?.name}
            </DialogTitle>
          </DialogHeader>
          
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={() => changeViewMonth(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-lg font-semibold">
              {months[viewMonth]} {viewYear}
            </h3>
            <Button variant="outline" size="sm" onClick={() => changeViewMonth(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 text-center">
              <p className="text-2xl font-bold text-green-600">{monthlyPresent}</p>
              <p className="text-xs text-green-700">Present</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 text-center">
              <p className="text-2xl font-bold text-red-600">{monthlyAbsent}</p>
              <p className="text-xs text-red-700">Absent</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 text-center">
              <p className="text-2xl font-bold text-amber-600">{monthlyLeave}</p>
              <p className="text-xs text-amber-700">Leave</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 text-center">
              <p className="text-2xl font-bold text-blue-600">{getWorkingDays()}</p>
              <p className="text-xs text-blue-700">Working Days</p>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="border rounded-lg p-4">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {generateCalendar().map((cell, idx) => (
                <div
                  key={idx}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                    ${cell ? getStatusColor(cell.status) : 'bg-transparent'}
                    ${cell && !cell.isWeekend && !cell.status ? 'border border-dashed border-gray-300' : ''}
                  `}
                >
                  {cell?.day || ''}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-xs">Present</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-xs">Absent</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-amber-500"></div>
                <span className="text-xs">Leave</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-gray-200"></div>
                <span className="text-xs">Weekend</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
            <div className="flex gap-2">
              <Button variant="outline">
                <Edit className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button onClick={downloadPDF} className="bg-primary">
                <Download className="w-4 h-4 mr-2" /> Download PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
