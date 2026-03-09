import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  User, Phone, Mail, MapPin, Building2, Calendar, CreditCard, FileText,
  Clock, CheckCircle, XCircle, TrendingUp, Award, Briefcase, Edit,
  ChevronLeft, Star, DollarSign, ClipboardList, UserCheck
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import EmployeeDocuments from '../components/EmployeeDocuments';

import { useCurrency } from '../contexts/CurrencyContext';
export default function EmployeeProfilePage() {
  const { currencySymbol } = useCurrency();
  const { api } = useAuth();
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  // Avoid null initial state which can briefly trigger the "not found" UI before data arrives.
  // Use an explicit loaded flag to differentiate "not loaded yet" vs "loaded but empty/invalid".
  const [profileData, setProfileData] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeProfile();
    }
  }, [employeeId]);

  const fetchEmployeeProfile = async () => {
    setLoading(true);
    try {
      const data = await api(`/api/employees/${employeeId}/full-profile`);
      setProfileData(data);
    } catch (err) {
      console.error('Failed to fetch employee profile:', err);
      toast.error('Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="text-center py-16">
        <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600">Employee Not Found</h2>
        <Button variant="link" onClick={() => navigate('/employees')}>
          Back to Employees
        </Button>
      </div>
    );
  }

  const { employee, store, attendance_summary, salary, performance, agreements } = profileData;

  const getStatusColor = (status) => {
    if (status === 'active' || employee.is_active) return 'bg-green-100 text-green-700';
    return 'bg-red-100 text-red-700';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return `${currencySymbol}0`;
    return `${currencySymbol}${parseInt(amount).toLocaleString('en-IN')}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="employee-profile-page">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        className="mb-4" 
        onClick={() => navigate('/employees')}
        data-testid="back-to-employees-btn"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Employees
      </Button>

      {/* Header Section */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                {employee.name?.charAt(0)?.toUpperCase() || 'E'}
              </div>
              
              {/* Basic Info */}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{employee.name}</h1>
                  <Badge className={getStatusColor(employee.status)}>
                    {employee.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-gray-500 flex items-center gap-2 mt-1">
                  <Badge variant="outline">{employee.employee_code}</Badge>
                  <span>•</span>
                  <span>{employee.designation || 'No Designation'}</span>
                </p>
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                  {employee.department && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {employee.department}
                    </span>
                  )}
                  {store && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {store.name}
                    </span>
                  )}
                  {employee.date_of_joining && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Joined {formatDate(employee.date_of_joining)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Edit Button */}
            <Button 
              variant="outline" 
              onClick={() => navigate(`/employees?edit=${employeeId}`)}
              data-testid="edit-employee-btn"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Attendance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Attendance (30d)</p>
                <p className="text-2xl font-bold text-green-600">{attendance_summary?.present || 0}</p>
                <p className="text-xs text-gray-400">Present days</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Absent */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Absent Days</p>
                <p className="text-2xl font-bold text-red-600">{attendance_summary?.absent || 0}</p>
                <p className="text-xs text-gray-400">Last 30 days</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Rating</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {performance?.average_rating || 0}
                  <span className="text-sm font-normal">/5</span>
                </p>
                <p className="text-xs text-gray-400">{performance?.total_reviews || 0} reviews</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Salary */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Monthly Salary</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(salary?.structure?.basic_salary || employee.salary)}
                </p>
                <p className="text-xs text-gray-400">Gross salary</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <User className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-attendance">
            <Clock className="w-4 h-4 mr-2" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="salary" data-testid="tab-salary">
            <CreditCard className="w-4 h-4 mr-2" />
            Salary
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">
            <TrendingUp className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Full Name" value={employee.name} />
                <InfoRow label="Employee Code" value={employee.employee_code} />
                <InfoRow label="Date of Birth" value={formatDate(employee.date_of_birth)} />
                <InfoRow label="Gender" value={employee.gender || 'Not specified'} />
                <InfoRow label="Blood Group" value={employee.blood_group || 'Not specified'} />
                <InfoRow label="Marital Status" value={employee.marital_status || 'Not specified'} />
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Phone" value={employee.phone} icon={<Phone className="w-4 h-4" />} />
                <InfoRow label="Email" value={employee.email} icon={<Mail className="w-4 h-4" />} />
                <InfoRow label="Address" value={employee.address} icon={<MapPin className="w-4 h-4" />} />
                <InfoRow label="Emergency Contact" value={employee.emergency_contact_name || 'Not provided'} />
                <InfoRow label="Emergency Phone" value={employee.emergency_contact_phone || 'Not provided'} />
              </CardContent>
            </Card>

            {/* Employment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Designation" value={employee.designation || 'Not assigned'} />
                <InfoRow label="Department" value={employee.department || 'General'} />
                <InfoRow label="Store/Location" value={store?.name || 'Not assigned'} />
                <InfoRow label="Date of Joining" value={formatDate(employee.date_of_joining)} />
                <InfoRow label="Employment Type" value={employee.employment_type || 'Full-time'} />
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Bank & ID Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Bank Name" value={employee.bank_name || 'Not provided'} />
                <InfoRow label="Account Number" value={employee.bank_account ? `****${employee.bank_account.slice(-4)}` : 'Not provided'} />
                <InfoRow label="IFSC Code" value={employee.ifsc_code || 'Not provided'} />
                <InfoRow label="PAN Number" value={employee.pan_number ? `****${employee.pan_number.slice(-4)}` : 'Not provided'} />
                <InfoRow label="Aadhaar" value={employee.aadhar_number ? `****${employee.aadhar_number.slice(-4)}` : 'Not provided'} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Summary - Last 30 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-green-600">{attendance_summary?.present || 0}</p>
                  <p className="text-sm text-green-700">Present</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-red-600">{attendance_summary?.absent || 0}</p>
                  <p className="text-sm text-red-700">Absent</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-yellow-600">{attendance_summary?.late || 0}</p>
                  <p className="text-sm text-yellow-700">Late</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Attendance Rate</span>
                  <span className="font-medium">
                    {attendance_summary?.total_records > 0 
                      ? Math.round((attendance_summary.present / attendance_summary.total_records) * 100)
                      : 0}%
                  </span>
                </div>
                <Progress 
                  value={attendance_summary?.total_records > 0 
                    ? (attendance_summary.present / attendance_summary.total_records) * 100 
                    : 0} 
                  className="h-2"
                />
              </div>
              
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={() => navigate(`/daily-attendance?employee=${employeeId}`)}>
                  View Full Attendance History
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Tab */}
        <TabsContent value="salary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Salary Structure</CardTitle>
              </CardHeader>
              <CardContent>
                {salary?.structure ? (
                  <div className="space-y-3">
                    <InfoRow label="Basic Salary" value={formatCurrency(salary.structure.basic_salary)} />
                    <InfoRow label="HRA" value={formatCurrency(salary.structure.hra)} />
                    <InfoRow label="DA" value={formatCurrency(salary.structure.da)} />
                    <InfoRow label="Other Allowances" value={formatCurrency(salary.structure.other_allowances)} />
                    <div className="border-t pt-3 mt-3">
                      <InfoRow 
                        label="Gross Salary" 
                        value={formatCurrency(salary.structure.gross_salary)} 
                        bold 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>No salary structure defined</p>
                    <Button variant="link" className="mt-2" onClick={() => navigate('/salary-calculator')}>
                      Set up salary structure
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Latest Payroll</CardTitle>
              </CardHeader>
              <CardContent>
                {salary?.latest_payroll ? (
                  <div className="space-y-3">
                    <InfoRow label="Month/Year" value={`${salary.latest_payroll.month}/${salary.latest_payroll.year}`} />
                    <InfoRow label="Working Days" value={salary.latest_payroll.working_days} />
                    <InfoRow label="Present Days" value={salary.latest_payroll.present_days} />
                    <InfoRow label="Gross Pay" value={formatCurrency(salary.latest_payroll.gross_pay)} />
                    <InfoRow label="Deductions" value={formatCurrency(salary.latest_payroll.total_deductions)} />
                    <div className="border-t pt-3 mt-3">
                      <InfoRow 
                        label="Net Pay" 
                        value={formatCurrency(salary.latest_payroll.net_pay)} 
                        bold 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>No payroll records found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Ratings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8 mb-6">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-2">
                    <span className="text-3xl font-bold text-yellow-600">
                      {performance?.average_rating || 0}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Average Rating</p>
                </div>
                <div className="flex-1">
                  <p className="text-gray-600 mb-2">Based on {performance?.total_reviews || 0} reviews</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star 
                        key={star}
                        className={`w-6 h-6 ${star <= (performance?.average_rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {performance?.recent_ratings?.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="font-medium">Recent Ratings</h4>
                  {performance.recent_ratings.map((rating, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{rating.month}/{rating.year}</p>
                          <p className="text-sm text-gray-500">{rating.reviewer_name || 'Manager'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                          <span className="font-bold">{rating.overall_rating}</span>
                        </div>
                      </div>
                      {rating.comments && (
                        <p className="mt-2 text-sm text-gray-600">{rating.comments}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Award className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No performance ratings yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Employment Documents & Agreements</CardTitle>
            </CardHeader>
            <CardContent>
              {agreements?.length > 0 ? (
                <div className="space-y-4">
                  {agreements.map((agreement, idx) => (
                    <div key={idx} className="p-4 border rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{agreement.agreement_type || 'Employment Agreement'}</p>
                          <p className="text-sm text-gray-500">
                            Created: {formatDate(agreement.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={agreement.status === 'signed' ? 'default' : 'secondary'}>
                        {agreement.status || 'Pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No agreements found</p>
                  <Button variant="link" className="mt-2" onClick={() => navigate('/employment-agreements')}>
                    Generate Agreement
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Employee Documents Upload Section */}
          <div className="mt-6">
            <EmployeeDocuments 
              employeeId={employeeId} 
              employeeName={employee?.name}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper component for info rows
function InfoRow({ label, value, icon, bold = false }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-gray-500 flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className={`${bold ? 'font-bold text-lg' : ''} text-right`}>
        {value || 'N/A'}
      </span>
    </div>
  );
}
