import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  Clock, Users, LogIn, LogOut, Calendar, Settings, RefreshCw, 
  Check, X, AlertTriangle, Timer, Building2, Calculator, 
  FileSpreadsheet, ChevronRight, Laptop, MapPin, Save,
  CheckCircle, XCircle, Coffee, UserCheck, UserX, Sun, Snowflake
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const STATUS_CONFIG = {
  present: { label: 'Present', color: 'bg-green-500', textColor: 'text-white', bgLight: 'bg-green-100 text-green-700' },
  absent: { label: 'Absent', color: 'bg-red-500', textColor: 'text-white', bgLight: 'bg-red-100 text-red-700' },
  late: { label: 'Late', color: 'bg-orange-500', textColor: 'text-white', bgLight: 'bg-orange-100 text-orange-700' },
  'half-day': { label: 'Half Day', color: 'bg-yellow-500', textColor: 'text-white', bgLight: 'bg-yellow-100 text-yellow-700' },
  leave: { label: 'Leave', color: 'bg-purple-500', textColor: 'text-white', bgLight: 'bg-purple-100 text-purple-700' },
  'week-off': { label: 'Week Off', color: 'bg-gray-400', textColor: 'text-white', bgLight: 'bg-gray-100 text-gray-700' },
  holiday: { label: 'Holiday', color: 'bg-blue-500', textColor: 'text-white', bgLight: 'bg-blue-100 text-blue-700' }
};

// Get current season based on month
const getCurrentSeason = () => {
  const month = new Date().getMonth();
  // Winter: November (10) to February (1)
  if (month >= 10 || month <= 1) return 'winter';
  return 'summer';
};

export default function CentralizedAttendancePage() {
  const { api, user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState('check-in');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [attendance, setAttendance] = useState({});
  const [myAttendance, setMyAttendance] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [clientIP, setClientIP] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [calculatingSalary, setCalculatingSalary] = useState(false);
  
  // Work Timing Configuration
  const [showTimingConfig, setShowTimingConfig] = useState(false);
  const [workTiming, setWorkTiming] = useState({
    enable_seasonal_timing: true,
    winter_start_time: '09:30',
    winter_end_time: '18:00',
    summer_start_time: '09:00',
    summer_end_time: '19:30',
    grace_period_minutes: 15,
    late_deduction_per_hour: 50
  });

  const currentSeason = getCurrentSeason();
  const currentShiftStart = workTiming.enable_seasonal_timing
    ? (currentSeason === 'winter' ? workTiming.winter_start_time : workTiming.summer_start_time)
    : workTiming.winter_start_time;
  const currentShiftEnd = workTiming.enable_seasonal_timing
    ? (currentSeason === 'winter' ? workTiming.winter_end_time : workTiming.summer_end_time)
    : workTiming.winter_end_time;

  // Fetch initial data
  useEffect(() => {
    fetchInitialData();
    fetchClientIP();
    fetchWorkTiming();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchEmployees();
      fetchTodayAttendance();
      fetchMyTodayAttendance();
    }
  }, [selectedStore, selectedDate]);

  useEffect(() => {
    if (selectedEmployee && selectedMonth !== null && selectedYear) {
      fetchAttendanceRecords();
    }
  }, [selectedEmployee, selectedMonth, selectedYear]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const storesData = await api('/api/stores');
      setStores(storesData);
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

  const fetchEmployees = async () => {
    try {
      const data = await api(`/api/employees?store_id=${selectedStore}`);
      setEmployees(data.filter(e => e.is_active !== false));
    } catch (err) {
      console.error('Failed to load employees');
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const data = await api(`/api/attendance?date=${selectedDate}&store_id=${selectedStore}`);
      const attMap = {};
      data.forEach(a => { attMap[a.employee_id] = a; });
      setAttendance(attMap);
    } catch (err) {
      console.error('Failed to load attendance');
    }
  };

  const fetchMyTodayAttendance = async () => {
    try {
      // Find current user's employee record
      const empData = await api('/api/employees/my-profile');
      if (empData?.id) {
        const today = new Date().toISOString().split('T')[0];
        const attData = await api(`/api/attendance?employee_id=${empData.id}&date=${today}`);
        setMyAttendance(attData.length > 0 ? attData[0] : null);
      }
    } catch (err) {
      // User might not be an employee
      setMyAttendance(null);
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;
      const data = await api(`/api/attendance?employee_id=${selectedEmployee}&start_date=${startDate}&end_date=${endDate}`);
      setAttendanceRecords(data);
    } catch (err) {
      console.error('Failed to load attendance records');
    }
  };

  const fetchClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setClientIP(data.ip);
    } catch (err) {
      setClientIP('Unknown');
    }
  };

  const fetchWorkTiming = async () => {
    try {
      const data = await api('/api/work-timing');
      if (data) {
        setWorkTiming(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      // Use defaults
    }
  };

  const saveWorkTiming = async () => {
    try {
      await api('/api/work-timing', {
        method: 'POST',
        body: JSON.stringify(workTiming)
      });
      toast.success('Work timing configuration saved');
      setShowTimingConfig(false);
    } catch (err) {
      toast.error('Failed to save work timing');
    }
  };

  // Self Check-in/Check-out
  const handleSelfCheckIn = async () => {
    setCheckingIn(true);
    try {
      const result = await api('/api/attendance/self-check', {
        method: 'POST',
        body: JSON.stringify({
          action: 'check_in',
          ip_address: clientIP,
          device_info: navigator.userAgent
        })
      });
      
      setMyAttendance(result.attendance);
      toast.success(`Check-in successful at ${new Date(result.attendance.check_in).toLocaleTimeString()}`, {
        description: result.is_late ? `Late by ${result.late_hours.toFixed(1)} hours` : 'On time!'
      });
      fetchTodayAttendance();
    } catch (err) {
      toast.error(err.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSelfCheckOut = async () => {
    setCheckingIn(true);
    try {
      const result = await api('/api/attendance/self-check', {
        method: 'POST',
        body: JSON.stringify({
          action: 'check_out',
          ip_address: clientIP,
          device_info: navigator.userAgent
        })
      });
      
      setMyAttendance(result.attendance);
      toast.success(`Check-out successful`, {
        description: `Total hours: ${result.attendance.total_hours?.toFixed(2) || 'N/A'}`
      });
      fetchTodayAttendance();
    } catch (err) {
      toast.error(err.message || 'Check-out failed');
    } finally {
      setCheckingIn(false);
    }
  };

  // Admin mark attendance
  const markEmployeeAttendance = async (employeeId, status, inTime, outTime) => {
    try {
      await api('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          store_id: selectedStore,
          date: selectedDate,
          status: status,
          in_time: inTime,
          out_time: outTime
        })
      });
      toast.success('Attendance marked');
      fetchTodayAttendance();
    } catch (err) {
      toast.error('Failed to mark attendance');
    }
  };

  // Calculate salary with deductions
  const calculateSalary = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }
    
    setCalculatingSalary(true);
    try {
      const data = await api(`/api/salary-calculator/auto-calculate?employee_id=${selectedEmployee}&month=${selectedMonth + 1}&year=${selectedYear}`);
      setSalaryData(data);
      toast.success('Salary calculated');
    } catch (err) {
      toast.error('Failed to calculate salary');
    } finally {
      setCalculatingSalary(false);
    }
  };

  // Calculate attendance stats
  const getAttendanceStats = () => {
    const presentCount = employees.filter(e => attendance[e.id]?.status === 'present').length;
    const absentCount = employees.filter(e => attendance[e.id]?.status === 'absent').length;
    const lateCount = employees.filter(e => (attendance[e.id]?.late_hours || 0) > 0).length;
    const unmarkedCount = employees.filter(e => !attendance[e.id]).length;
    const totalLateHours = Object.values(attendance).reduce((sum, a) => sum + (a?.late_hours || 0), 0);
    // Count check-ins and check-outs
    const checkedInCount = Object.values(attendance).filter(a => a?.check_in || a?.in_time).length;
    const checkedOutCount = Object.values(attendance).filter(a => a?.check_out || a?.out_time).length;
    return { presentCount, absentCount, lateCount, unmarkedCount, totalLateHours, checkedInCount, checkedOutCount };
  };

  const stats = getAttendanceStats();
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="centralized-attendance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Centralized Attendance System
          </h1>
          <p className="text-muted-foreground">Check-in, Check-out, and Salary Management</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button variant="outline" onClick={() => setShowTimingConfig(true)} data-testid="config-timing-btn">
            <Settings className="w-4 h-4 mr-2" />
            Work Timing
          </Button>
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-44" data-testid="store-selector">
              <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select Store" />
            </SelectTrigger>
            <SelectContent>
              {stores.map(store => (
                <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Current Season Banner */}
      <Card className={`border-2 ${currentSeason === 'winter' ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' : 'border-orange-300 bg-orange-50 dark:bg-orange-950/20'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${currentSeason === 'winter' ? 'bg-blue-500' : 'bg-orange-500'}`}>
                {currentSeason === 'winter' ? <Snowflake className="w-6 h-6 text-white" /> : <Sun className="w-6 h-6 text-white" />}
              </div>
              <div>
                <p className="font-bold text-lg">{currentSeason === 'winter' ? 'Winter Timing' : 'Summer Timing'}</p>
                <p className="text-sm text-muted-foreground">
                  Shift: {currentShiftStart} - {currentShiftEnd} | Grace: {workTiming.grace_period_minutes} mins
                </p>
              </div>
            </div>
            <Badge className={currentSeason === 'winter' ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'}>
              {currentSeason.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="check-in" data-testid="tab-checkin">
            <LogIn className="w-4 h-4 mr-2" />
            Self Check-in
          </TabsTrigger>
          <TabsTrigger value="admin" data-testid="tab-admin">
            <Users className="w-4 h-4 mr-2" />
            Admin Mark
          </TabsTrigger>
          <TabsTrigger value="sheet" data-testid="tab-sheet">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Attendance Sheet
          </TabsTrigger>
          <TabsTrigger value="salary" data-testid="tab-salary">
            <Calculator className="w-4 h-4 mr-2" />
            Salary Calculator
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Self Check-in/Check-out */}
        <TabsContent value="check-in" className="space-y-4">
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-primary" />
                Employee Self Check-in/Check-out
              </CardTitle>
              <CardDescription>
                Mark your attendance from office laptop with IP tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* IP Info */}
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Your IP: <strong>{clientIP || 'Detecting...'}</strong></span>
              </div>

              {/* Current Status */}
              {myAttendance ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
                      <CardContent className="pt-4 text-center">
                        <LogIn className="w-8 h-8 mx-auto text-green-600 mb-2" />
                        <p className="text-sm text-muted-foreground">Check-in</p>
                        <p className="text-xl font-bold text-green-700">
                          {myAttendance.check_in ? new Date(myAttendance.check_in).toLocaleTimeString() : '--:--'}
                        </p>
                        {myAttendance.late_hours > 0 && (
                          <Badge className="mt-2 bg-orange-100 text-orange-700">
                            Late: {myAttendance.late_hours.toFixed(1)}h
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                    <Card className={`${myAttendance.check_out ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : 'bg-gray-50 dark:bg-gray-950/20 border-gray-200'}`}>
                      <CardContent className="pt-4 text-center">
                        <LogOut className="w-8 h-8 mx-auto text-red-600 mb-2" />
                        <p className="text-sm text-muted-foreground">Check-out</p>
                        <p className="text-xl font-bold text-red-700">
                          {myAttendance.check_out ? new Date(myAttendance.check_out).toLocaleTimeString() : '--:--'}
                        </p>
                        {myAttendance.total_hours && (
                          <Badge className="mt-2 bg-blue-100 text-blue-700">
                            Total: {myAttendance.total_hours.toFixed(1)}h
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Check-out button if checked in but not out */}
                  {myAttendance.check_in && !myAttendance.check_out && (
                    <Button 
                      onClick={handleSelfCheckOut} 
                      disabled={checkingIn}
                      className="w-full h-16 text-lg bg-red-600 hover:bg-red-700"
                      data-testid="checkout-btn"
                    >
                      {checkingIn ? (
                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <LogOut className="w-5 h-5 mr-2" />
                      )}
                      Check Out Now
                    </Button>
                  )}

                  {myAttendance.check_out && (
                    <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
                      <CheckCircle className="w-8 h-8 mx-auto text-green-600 mb-2" />
                      <p className="font-semibold text-green-700">Attendance Complete for Today!</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">You haven't checked in today</p>
                  <Button 
                    onClick={handleSelfCheckIn} 
                    disabled={checkingIn}
                    className="w-full h-16 text-lg bg-green-600 hover:bg-green-700"
                    data-testid="checkin-btn"
                  >
                    {checkingIn ? (
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <LogIn className="w-5 h-5 mr-2" />
                    )}
                    Check In Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Admin Mark Attendance */}
        <TabsContent value="admin" className="space-y-4">
          {/* Date Selector */}
          <div className="flex items-center gap-4">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44"
              data-testid="date-selector"
            />
            <Button variant="outline" onClick={fetchTodayAttendance}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Badge variant={isToday ? 'default' : 'secondary'}>
              {isToday ? 'TODAY' : 'Historical'}
            </Badge>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4 pb-4 text-center">
                <UserCheck className="w-6 h-6 mx-auto text-green-600 mb-1" />
                <p className="text-2xl font-bold text-green-600">{stats.presentCount}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-4 pb-4 text-center">
                <UserX className="w-6 h-6 mx-auto text-red-600 mb-1" />
                <p className="text-2xl font-bold text-red-600">{stats.absentCount}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
              <CardContent className="pt-4 pb-4 text-center">
                <LogIn className="w-6 h-6 mx-auto text-emerald-600 mb-1" />
                <p className="text-2xl font-bold text-emerald-600">{stats.checkedInCount}</p>
                <p className="text-xs text-muted-foreground">Checked In</p>
              </CardContent>
            </Card>
            <Card className="border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20">
              <CardContent className="pt-4 pb-4 text-center">
                <LogOut className="w-6 h-6 mx-auto text-indigo-600 mb-1" />
                <p className="text-2xl font-bold text-indigo-600">{stats.checkedOutCount}</p>
                <p className="text-xs text-muted-foreground">Checked Out</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-4 pb-4 text-center">
                <AlertTriangle className="w-6 h-6 mx-auto text-orange-600 mb-1" />
                <p className="text-2xl font-bold text-orange-600">{stats.lateCount}</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-4 pb-4 text-center">
                <Timer className="w-6 h-6 mx-auto text-blue-600 mb-1" />
                <p className="text-2xl font-bold text-blue-600">{stats.totalLateHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Late Hours</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 bg-gray-50 dark:bg-gray-950/20">
              <CardContent className="pt-4 pb-4 text-center">
                <Users className="w-6 h-6 mx-auto text-gray-600 mb-1" />
                <p className="text-2xl font-bold text-gray-600">{stats.unmarkedCount}</p>
                <p className="text-xs text-muted-foreground">Unmarked</p>
              </CardContent>
            </Card>
          </div>

          {/* Today's Attendance Log - Shows Both Check-in & Check-out */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                Today's Attendance Log (Check-in & Check-out Records)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Employee</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Department</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold bg-green-100 text-green-800">
                        <div className="flex items-center justify-center gap-1">
                          <LogIn className="w-4 h-4" /> Check-in Time
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold bg-red-100 text-red-800">
                        <div className="flex items-center justify-center gap-1">
                          <LogOut className="w-4 h-4" /> Check-out Time
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Total Hours</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Late/On Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp, idx) => {
                      const att = attendance[emp.id];
                      const checkInTime = att?.in_time || (att?.check_in ? new Date(att.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null);
                      const checkOutTime = att?.out_time || (att?.check_out ? new Date(att.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null);
                      const totalHours = att?.total_hours;
                      const isLate = (att?.late_hours || 0) > 0;
                      
                      return (
                        <tr key={emp.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isLate ? 'bg-orange-50' : ''}`}>
                          <td className="px-4 py-3 font-medium">{emp.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{emp.department || 'General'}</td>
                          <td className="px-4 py-3 text-center">
                            {checkInTime ? (
                              <Badge className="bg-green-100 text-green-700 font-mono">
                                {checkInTime}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">--:--</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {checkOutTime ? (
                              <Badge className="bg-red-100 text-red-700 font-mono">
                                {checkOutTime}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">--:--</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {totalHours ? (
                              <Badge className="bg-blue-100 text-blue-700">
                                {totalHours.toFixed(1)}h
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {att?.status ? (
                              <Badge className={STATUS_CONFIG[att.status]?.bgLight || 'bg-gray-100'}>
                                {STATUS_CONFIG[att.status]?.label || att.status}
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-500">Not Marked</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {att?.status === 'present' && (
                              isLate ? (
                                <Badge className="bg-orange-100 text-orange-700">
                                  Late: {att.late_hours.toFixed(1)}h
                                </Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-700">On Time</Badge>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Employee Attendance List */}
          <div className="space-y-3">
            {employees.map(emp => {
              const att = attendance[emp.id];
              const isLate = (att?.late_hours || 0) > 0;
              
              return (
                <Card 
                  key={emp.id}
                  className={`transition-all ${
                    att?.status === 'present' ? (isLate ? 'border-orange-200 bg-orange-50/50' : 'border-green-200 bg-green-50/50') :
                    att?.status === 'absent' ? 'border-red-200 bg-red-50/50' :
                    att?.status === 'leave' ? 'border-purple-200 bg-purple-50/50' : ''
                  }`}
                  data-testid={`employee-row-${emp.id}`}
                >
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Employee Info */}
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          att?.status === 'present' ? (isLate ? 'bg-orange-500' : 'bg-green-500') :
                          att?.status === 'absent' ? 'bg-red-500' :
                          att?.status === 'leave' ? 'bg-purple-500' : 'bg-gray-400'
                        }`}>
                          {emp.name?.charAt(0)?.toUpperCase() || '#'}
                        </div>
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.department || 'General'}</p>
                        </div>
                      </div>

                      {/* Status Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant={att?.status === 'present' ? 'default' : 'outline'}
                          className={att?.status === 'present' ? 'bg-green-600' : 'border-green-300 text-green-700'}
                          onClick={() => markEmployeeAttendance(emp.id, 'present', currentShiftStart, currentShiftEnd)}
                        >
                          <Check className="w-4 h-4 mr-1" /> Present
                        </Button>
                        <Button
                          size="sm"
                          variant={att?.status === 'absent' ? 'default' : 'outline'}
                          className={att?.status === 'absent' ? 'bg-red-600' : 'border-red-300 text-red-700'}
                          onClick={() => markEmployeeAttendance(emp.id, 'absent', null, null)}
                        >
                          <X className="w-4 h-4 mr-1" /> Absent
                        </Button>
                        <Button
                          size="sm"
                          variant={att?.status === 'leave' ? 'default' : 'outline'}
                          className={att?.status === 'leave' ? 'bg-purple-600' : 'border-purple-300 text-purple-700'}
                          onClick={() => markEmployeeAttendance(emp.id, 'leave', null, null)}
                        >
                          <Coffee className="w-4 h-4 mr-1" /> Leave
                        </Button>
                      </div>

                      {/* Time Inputs for Present */}
                      {att?.status === 'present' && (
                        <div className="flex items-center gap-4 ml-auto">
                          <div className="flex items-center gap-2">
                            <LogIn className="w-4 h-4 text-green-600" />
                            <Input
                              type="time"
                              defaultValue={att?.in_time || att?.check_in?.split('T')[1]?.substring(0, 5) || currentShiftStart}
                              onBlur={(e) => markEmployeeAttendance(emp.id, 'present', e.target.value, att?.out_time || currentShiftEnd)}
                              className="w-28 h-8"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <LogOut className="w-4 h-4 text-red-600" />
                            <Input
                              type="time"
                              defaultValue={att?.out_time || att?.check_out?.split('T')[1]?.substring(0, 5) || currentShiftEnd}
                              onBlur={(e) => markEmployeeAttendance(emp.id, 'present', att?.in_time || currentShiftStart, e.target.value)}
                              className="w-28 h-8"
                            />
                          </div>
                          {isLate && (
                            <Badge className="bg-orange-100 text-orange-700">
                              <Timer className="w-3 h-3 mr-1" />
                              Late: {att.late_hours.toFixed(1)}h
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Status Badge */}
                      {att?.status && (
                        <Badge className={`ml-auto ${STATUS_CONFIG[att.status]?.bgLight || 'bg-gray-100'}`}>
                          {STATUS_CONFIG[att.status]?.label || att.status}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {employees.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No employees found in this store</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Attendance Sheet */}
        <TabsContent value="sheet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                Monthly Attendance Sheet
              </CardTitle>
              <CardDescription>
                View attendance details with late/on-time status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <Label className="text-sm">Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Select Employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Month</Label>
                  <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, idx) => (
                        <SelectItem key={idx} value={String(idx)}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Year</Label>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-32">
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

              {/* Attendance Summary */}
              {selectedEmployee && attendanceRecords.length > 0 && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="py-3 text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {attendanceRecords.filter(r => r.status === 'present').length}
                        </p>
                        <p className="text-xs text-green-700">Present</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="py-3 text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {attendanceRecords.filter(r => r.status === 'absent').length}
                        </p>
                        <p className="text-xs text-red-700">Absent</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-orange-50 border-orange-200">
                      <CardContent className="py-3 text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {attendanceRecords.filter(r => (r.late_hours || 0) > 0).length}
                        </p>
                        <p className="text-xs text-orange-700">Late Days</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="py-3 text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {attendanceRecords.reduce((sum, r) => sum + (r.late_hours || 0), 0).toFixed(1)}h
                        </p>
                        <p className="text-xs text-blue-700">Total Late</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="py-3 text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {attendanceRecords.filter(r => r.status === 'leave').length}
                        </p>
                        <p className="text-xs text-purple-700">Leave</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Attendance Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Day</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold">Check-in</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold">Check-out</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold">Late Hours</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold">Remark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRecords.map((record, idx) => {
                          const date = new Date(record.date);
                          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                          const isLate = (record.late_hours || 0) > 0;
                          
                          return (
                            <tr key={idx} className={`border-b ${isLate ? 'bg-orange-50' : ''}`}>
                              <td className="px-4 py-3 font-medium">{record.date}</td>
                              <td className="px-4 py-3">{dayName}</td>
                              <td className="px-4 py-3">
                                <Badge className={STATUS_CONFIG[record.status]?.bgLight || 'bg-gray-100'}>
                                  {STATUS_CONFIG[record.status]?.label || record.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {record.in_time || record.check_in?.split('T')[1]?.substring(0, 5) || '--:--'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {record.out_time || record.check_out?.split('T')[1]?.substring(0, 5) || '--:--'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isLate ? (
                                  <Badge className="bg-orange-100 text-orange-700">
                                    {record.late_hours.toFixed(1)}h
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-700">On Time</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isLate ? (
                                  <span className="text-orange-600 text-sm">Came Late</span>
                                ) : record.status === 'present' ? (
                                  <span className="text-green-600 text-sm">On Time</span>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {!selectedEmployee && (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select an employee to view attendance sheet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Salary Calculator */}
        <TabsContent value="salary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Salary Calculator with Late Deductions
              </CardTitle>
              <CardDescription>
                Calculate salary based on attendance with hourly late deductions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label className="text-sm">Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Select Employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Month</Label>
                  <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, idx) => (
                        <SelectItem key={idx} value={String(idx)}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Year</Label>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={calculateSalary} 
                  disabled={!selectedEmployee || calculatingSalary}
                  data-testid="calculate-salary-btn"
                >
                  {calculatingSalary ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="w-4 h-4 mr-2" />
                  )}
                  Calculate Salary
                </Button>
              </div>

              {/* Salary Breakdown */}
              {salaryData && (
                <div className="space-y-4 mt-6">
                  <Separator />
                  
                  {/* Employee & Period Info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Employee</p>
                        <p className="text-lg font-bold">{salaryData.employee?.name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">{salaryData.employee?.department || 'General'}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Period</p>
                        <p className="text-lg font-bold">{MONTHS[selectedMonth]} {selectedYear}</p>
                        <p className="text-sm text-muted-foreground">Working Days: {salaryData.period?.working_days || 26}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Attendance Summary */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Attendance Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{salaryData.attendance?.present_days || 0}</p>
                          <p className="text-xs text-green-700">Present Days</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">{salaryData.attendance?.absent_days || 0}</p>
                          <p className="text-xs text-red-700">Absent Days</p>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <p className="text-2xl font-bold text-orange-600">{salaryData.attendance?.late_days || 0}</p>
                          <p className="text-xs text-orange-700">Late Days</p>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">{salaryData.attendance?.total_late_hours?.toFixed(1) || 0}h</p>
                          <p className="text-xs text-blue-700">Total Late Hours</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Salary Breakdown */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Salary Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b">
                          <span>Gross Salary</span>
                          <span className="font-semibold">{formatCurrency(salaryData.summary?.gross_salary || 0)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b text-red-600">
                          <span>Absence Deduction ({salaryData.attendance?.absent_days || 0} days)</span>
                          <span>- {formatCurrency(salaryData.deductions?.absence_deduction || 0)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b text-orange-600">
                          <span>Late Hours Deduction ({salaryData.attendance?.total_late_hours?.toFixed(1) || 0}h)</span>
                          <span>- {formatCurrency(salaryData.deductions?.late_hours_deduction || 0)}</span>
                        </div>
                        {salaryData.deductions?.other_deductions > 0 && (
                          <div className="flex justify-between py-2 border-b text-gray-600">
                            <span>Other Deductions</span>
                            <span>- {formatCurrency(salaryData.deductions?.other_deductions || 0)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between py-3 text-lg">
                          <span className="font-bold">Net Salary</span>
                          <span className="font-bold text-green-600">{formatCurrency(salaryData.summary?.final_salary || 0)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Per Hour Rate Info */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-4">
                        <Timer className="w-8 h-8 text-blue-600" />
                        <div>
                          <p className="text-sm text-blue-700">Hourly Rate for Deductions</p>
                          <p className="text-xl font-bold text-blue-600">
                            {formatCurrency(salaryData.salary_structure?.hourly_rate || 0)} / hour
                          </p>
                          <p className="text-xs text-blue-600">
                            Late deduction = Late Hours × Hourly Rate
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {!salaryData && (
                <div className="text-center py-12 text-muted-foreground">
                  <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select an employee and click Calculate to view salary breakdown</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Work Timing Configuration Modal */}
      <Dialog open={showTimingConfig} onOpenChange={setShowTimingConfig}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Work Timing Configuration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Seasonal Timing Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Enable Seasonal Timing</Label>
                <p className="text-sm text-muted-foreground">Different timings for winter and summer</p>
              </div>
              <Switch
                checked={workTiming.enable_seasonal_timing}
                onCheckedChange={(v) => setWorkTiming(prev => ({ ...prev, enable_seasonal_timing: v }))}
              />
            </div>

            <Separator />

            {/* Winter Timing */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-blue-500" />
                <Label className="text-base font-medium">Winter Timing (Nov - Feb)</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Start Time</Label>
                  <Input
                    type="time"
                    value={workTiming.winter_start_time}
                    onChange={(e) => setWorkTiming(prev => ({ ...prev, winter_start_time: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm">End Time</Label>
                  <Input
                    type="time"
                    value={workTiming.winter_end_time}
                    onChange={(e) => setWorkTiming(prev => ({ ...prev, winter_end_time: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Summer Timing */}
            {workTiming.enable_seasonal_timing && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sun className="w-5 h-5 text-orange-500" />
                  <Label className="text-base font-medium">Summer Timing (Mar - Oct)</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Start Time</Label>
                    <Input
                      type="time"
                      value={workTiming.summer_start_time}
                      onChange={(e) => setWorkTiming(prev => ({ ...prev, summer_start_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">End Time</Label>
                    <Input
                      type="time"
                      value={workTiming.summer_end_time}
                      onChange={(e) => setWorkTiming(prev => ({ ...prev, summer_end_time: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Grace Period & Deductions */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Grace Period (minutes)</Label>
                <Input
                  type="number"
                  value={workTiming.grace_period_minutes}
                  onChange={(e) => setWorkTiming(prev => ({ ...prev, grace_period_minutes: parseInt(e.target.value) || 0 }))}
                  min={0}
                  max={60}
                />
                <p className="text-xs text-muted-foreground mt-1">Buffer time before marking late</p>
              </div>
              <div>
                <Label className="text-sm">Late Deduction (per hour)</Label>
                <Input
                  type="number"
                  value={workTiming.late_deduction_per_hour}
                  onChange={(e) => setWorkTiming(prev => ({ ...prev, late_deduction_per_hour: parseInt(e.target.value) || 0 }))}
                  min={0}
                />
                <p className="text-xs text-muted-foreground mt-1">Amount deducted per late hour</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimingConfig(false)}>Cancel</Button>
            <Button onClick={saveWorkTiming} data-testid="save-timing-btn">
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
