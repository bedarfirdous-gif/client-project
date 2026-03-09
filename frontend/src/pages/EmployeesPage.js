import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { usePermissions } from '../contexts/PermissionContext';
import { useReAuth } from '../components/ReAuthProvider';
import { toast } from 'sonner';
import { Plus, Search, Edit, UserCircle, Phone, Mail, MapPin, Building2, FileText, CheckCircle, Clock, XCircle, UserPlus, Eye, Trash2, Download, IdCard, TrendingUp, Upload, File, X as XIcon, FileCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import EmploymentApplicationForm from '../components/EmploymentApplicationForm';
import EmployeeIDCard from '../components/EmployeeIDCard';
import jsPDF from 'jspdf';

const APPLICATION_STATUS_CONFIG = {
  pending_review: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-700', icon: Eye },
  documents_pending: { label: 'Documents Pending', color: 'bg-orange-100 text-orange-700', icon: FileText },
  interview_scheduled: { label: 'Interview Scheduled', color: 'bg-purple-100 text-purple-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  converted_to_employee: { label: 'Converted', color: 'bg-gray-100 text-gray-700', icon: UserPlus }
};

export default function EmployeesPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const { canPerformAction } = usePermissions();
  const { requireSensitiveAuth } = useReAuth();
  const [employees, setEmployees] = useState([]);
  const [timeout, setTimeout] = useState(false);
  const [lineWidth, setLineWidth] = useState(false);
  const [textColor, setTextColor] = useState(false);
  const [lineDashPattern, setLineDashPattern] = useState(false);
  const [drawColor, setDrawColor] = useState(false);
  const [fillColor, setFillColor] = useState(false);
  const [font, setFont] = useState(false);
  const [fontSize, setFontSize] = useState(false);
  const [applications, setApplications] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  // Avoid null-initialized state that can cause a brief conditional-render mismatch (flash)
  // when the component first mounts / data arrives. Use stable defaults instead.
  const [selectedApplication, setSelectedApplication] = useState({});
  const [activeTab, setActiveTab] = useState('employees');
  const [editEmployee, setEditEmployee] = useState({});
  // Keep as an explicit open flag elsewhere; use boolean default to prevent null->object flicker.
  const [showIDCard, setShowIDCard] = useState(false);
  const [convertData, setConvertData] = useState({
    store_id: '',
    date_of_joining: '',
    salary: '',
    employment_type: 'full-time',
    employee_code: ''
  });
  const [form, setForm] = useState({
    employee_code: '', name: '', email: '', phone: '', store_id: '',
    department: 'general', designation: '', date_of_joining: '',
    gender: 'other', address: '', bank_account: '', bank_name: '',
    ifsc_code: '', pan_number: '', aadhar_number: ''
  });
  // Avoid null-initialized state that can cause a brief conditional-render mismatch (flash)
  // when UI checks like `selectedEmployee && ...` or `showDeleteConfirm && ...` flip from null->object.
  // Use stable defaults plus explicit "loaded" flags for async-populated objects.
  const [selectedEmployee, setSelectedEmployee] = useState({});
  const [isSelectedEmployeeLoaded, setIsSelectedEmployeeLoaded] = useState(false);

  const [employeeProfile, setEmployeeProfile] = useState({});
  const [isEmployeeProfileLoaded, setIsEmployeeProfileLoaded] = useState(false);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [lockedFields, setLockedFields] = useState({});

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Edit Application State
  const [editingApplication, setEditingApplication] = useState(null);
  
  // Employee Upgrade State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeEmployee, setUpgradeEmployee] = useState({});
  const [isUpgradeEmployeeLoaded, setIsUpgradeEmployeeLoaded] = useState(false);
  const [upgradeHistory, setUpgradeHistory] = useState([]);
  const [upgradeForm, setUpgradeForm] = useState({
    designation: '',
    basic_salary: '',
    effective_date: '',
    reason: ''
  });
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  
  // Document Upload State
  const [documents, setDocuments] = useState({
    aadhar_card: null,
    pan_card: null,
    qualification_certificate: null,
    guardian_consent_letter: null
  });
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const aadharInputRef = useRef(null);
  const panInputRef = useRef(null);
  const qualificationInputRef = useRef(null);
  const consentInputRef = useRef(null);

  const DOCUMENT_TYPES = {
    aadhar_card: { label: 'Aadhar Card', icon: IdCard, required: true },
    pan_card: { label: 'PAN Card', icon: FileText, required: true },
    qualification_certificate: { label: 'Qualification Certificate', icon: FileCheck, required: false },
    guardian_consent_letter: { label: 'Guardian/Father Consent Letter', icon: FileText, required: false }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empData, storesData, appData] = await Promise.all([
        api('/api/employees?include_inactive=true'),
        api('/api/stores'),
        api('/api/employment-applications'),
      ]);
      setStores(storesData);
      setEmployees(empData);
      setApplications(appData);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchNextEmployeeCode = async () => {
    try {
      const data = await api('/api/employees/next-code');
      return data.next_code;
    } catch (err) {
      console.error('Failed to fetch next employee code');
      return '';
    }
  };

  const fetchEmployeeProfile = async (employeeId) => {
    setProfileLoading(true);
    try {
      const data = await api(`/api/employees/${employeeId}/full-profile`);
      setEmployeeProfile(data);
      setShowProfileModal(true);
    } catch (err) {
      toast.error('Failed to load employee profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Search for existing employees or applications by name
  const searchByName = (name) => {
    if (!name || name.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    const searchTerm = name.toLowerCase();
    
    // Search in existing employees
    const matchedEmployees = employees.filter(emp => 
      emp.name?.toLowerCase().includes(searchTerm)
    ).map(emp => ({ ...emp, source: 'employee' }));
    
    // Search in applications (not yet converted)
    const matchedApplications = applications.filter(app => 
      app.full_name?.toLowerCase().includes(searchTerm) && 
      app.status !== 'converted_to_employee'
    ).map(app => ({ ...app, source: 'application' }));
    
    const results = [...matchedEmployees, ...matchedApplications];
    setSearchResults(results);
    setShowSearchResults(results.length > 0);
  };

  // Auto-fill form with selected employee/application data
  const autoFillFromSelection = async (selection) => {
    const locked = {};
    let newForm = { ...form };
    
    if (selection.source === 'employee') {
      // Fill from existing employee
      newForm = {
        employee_code: selection.employee_code || form.employee_code,
        name: selection.name || '',
        email: selection.email || '',
        phone: selection.phone || '',
        store_id: selection.store_id || '',
        department: selection.department || 'general',
        designation: selection.designation || '',
        date_of_joining: selection.date_of_joining || '',
        gender: selection.gender || 'other',
        address: selection.address || '',
        bank_account: selection.bank_account || '',
        bank_name: selection.bank_name || '',
        ifsc_code: selection.ifsc_code || '',
        pan_number: selection.pan_number || '',
        aadhar_number: selection.aadhar_number || ''
      };
      
      // Mark fields with data as locked (read-only)
      Object.keys(newForm).forEach(key => {
        if (newForm[key] && newForm[key] !== '' && newForm[key] !== 'general' && newForm[key] !== 'other') {
          locked[key] = true;
        }
      });
      
      setEditEmployee(selection);
      toast.info(`Loaded data for ${selection.name}. Filled fields are locked, empty fields are editable.`);
      
    } else if (selection.source === 'application') {
      // Fill from application
      const nextCode = await fetchNextEmployeeCode();
      newForm = {
        employee_code: nextCode,
        name: selection.full_name || '',
        email: selection.email || '',
        phone: selection.contact_number || '',
        store_id: selection.preferred_store || '',
        department: selection.department || 'general',
        designation: selection.position_applied || '',
        date_of_joining: selection.expected_start_date || '',
        gender: selection.gender || 'other',
        address: selection.address || '',
        bank_account: '',
        bank_name: '',
        ifsc_code: '',
        pan_number: '',
        aadhar_number: ''
      };
      
      // Mark fields with data as locked
      Object.keys(newForm).forEach(key => {
        if (newForm[key] && newForm[key] !== '' && newForm[key] !== 'general' && newForm[key] !== 'other') {
          locked[key] = true;
        }
      });
      
      // Employee code should always be editable for new employees
      locked['employee_code'] = false;
      
      toast.info(`Loaded data from application. Filled fields are locked, empty fields are editable.`);
    }
    
    setForm(newForm);
    setLockedFields(locked);
    setShowSearchResults(false);
  };

  // Clear locked fields and reset form
  const clearAutoFill = async () => {
    const nextCode = await fetchNextEmployeeCode();
    setForm({
      employee_code: nextCode, name: '', email: '', phone: '', store_id: '',
      department: 'general', designation: '', date_of_joining: '',
      gender: 'other', address: '', bank_account: '', bank_name: '',
      ifsc_code: '', pan_number: '', aadhar_number: ''
    });
    setLockedFields({});
    setEditEmployee(null);
    toast.success('Form cleared. All fields are now editable.');
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let employeeId = editEmployee?.id;
      
      if (editEmployee) {
        await api(`/api/employees/${editEmployee.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast.success('Employee updated');
      } else {
        const response = await api('/api/employees', { method: 'POST', body: JSON.stringify(form) });
        employeeId = response.id;
        toast.success('Employee created');
      }
      
      // Upload documents if any are selected
      const hasDocuments = Object.values(documents).some(doc => doc !== null);
      if (hasDocuments && employeeId) {
        toast.info('Uploading documents...');
        await uploadAllDocuments(employeeId);
        toast.success('Documents uploaded successfully');
      }
      
      setShowModal(false);
      setEditEmployee(null);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const resetForm = () => {
    setForm({
      employee_code: '', name: '', email: '', phone: '', store_id: '',
      department: 'general', designation: '', date_of_joining: '',
      gender: 'other', address: '', bank_account: '', bank_name: '',
      ifsc_code: '', pan_number: '', aadhar_number: ''
    });
    setLockedFields({});
    setDocuments({
      aadhar_card: null,
      pan_card: null,
      qualification_certificate: null,
      guardian_consent_letter: null
    });
    setUploadedDocs([]);
  };

  // Document Upload Functions
  const handleDocumentSelect = (docType, file) => {
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Allowed: PDF, JPG, PNG');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size: 5MB');
      return;
    }
    
    setDocuments(prev => ({ ...prev, [docType]: file }));
  };

  const removeDocument = (docType) => {
    setDocuments(prev => ({ ...prev, [docType]: null }));
  };

  const uploadDocument = async (employeeId, docType, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', docType);
    
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/employees/${employeeId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }
    
    return await response.json();
  };

  const uploadAllDocuments = async (employeeId) => {
    const docsToUpload = Object.entries(documents).filter(([_, file]) => file !== null);
    
    for (const [docType, file] of docsToUpload) {
      setUploadingDoc(docType);
      try {
        await uploadDocument(employeeId, docType, file);
      } catch (err) {
        toast.error(`Failed to upload ${DOCUMENT_TYPES[docType].label}: ${err.message}`);
      }
    }
    setUploadingDoc(null);
  };

  const fetchEmployeeDocuments = async (employeeId) => {
    try {
      const response = await api(`/api/employees/${employeeId}/files`);
      setUploadedDocs(response || []);
    } catch (err) {
      setUploadedDocs([]);
    }
  };

  const openEdit = (emp) => {
    setEditEmployee(emp);
    setForm({
      employee_code: emp.employee_code || '', name: emp.name, email: emp.email || '',
      phone: emp.phone || '', store_id: emp.store_id || '', department: emp.department || 'general',
      designation: emp.designation || '', date_of_joining: emp.date_of_joining || '',
      gender: emp.gender || 'other', address: emp.address || '',
      bank_account: emp.bank_account || '', bank_name: emp.bank_name || '',
      ifsc_code: emp.ifsc_code || '', pan_number: emp.pan_number || '',
      aadhar_number: emp.aadhar_number || ''
    });
    // When editing, don't lock any fields - allow full editing
    setLockedFields({});
    // Reset document selections and fetch existing docs
    setDocuments({
      aadhar_card: null,
      pan_card: null,
      qualification_certificate: null,
      guardian_consent_letter: null
    });
    fetchEmployeeDocuments(emp.id);
    setShowModal(true);
  };

  // Open Edit Application Form
  const openEditApplication = (app) => {
    setEditingApplication(app);
    setShowApplicationForm(true);
  };
  
  // Close Application Form and reset edit state
  const closeApplicationForm = () => {
    setShowApplicationForm(false);
    setEditingApplication(null);
  };

  const getStoreName = (storeId) => {
    if (!storeId) return 'No Store';
    const store = stores.find(s => s.id === storeId);
    return store?.name || 'Loading...';
  };

  // Employee Upgrade Functions
  const openUpgradeModal = async (emp) => {
    setUpgradeEmployee(emp);
    setUpgradeForm({
      designation: emp.designation || '',
      basic_salary: emp.salary_info?.basic_salary || emp.salary || '',
      effective_date: new Date().toISOString().split('T')[0],
      reason: ''
    });
    
    // Fetch upgrade history
    try {
      const data = await api(`/api/employees/${emp.id}/upgrade-history`);
      setUpgradeHistory(data.history || []);
    } catch (err) {
      setUpgradeHistory([]);
    }
    
    setShowUpgradeModal(true);
  };

  const handleUpgradeSubmit = async () => {
    if (!upgradeForm.designation || !upgradeForm.basic_salary) {
      toast.error('Please fill in designation and salary');
      return;
    }
    
    setUpgradeLoading(true);
    try {
      await api(`/api/employees/${upgradeEmployee.id}/upgrade`, {
        method: 'POST',
        body: JSON.stringify({
          designation: upgradeForm.designation,
          basic_salary: parseFloat(upgradeForm.basic_salary),
          effective_date: upgradeForm.effective_date,
          reason: upgradeForm.reason
        })
      });
      toast.success('Employee upgraded successfully');
      setShowUpgradeModal(false);
      setUpgradeEmployee(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to upgrade employee');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const updateApplicationStatus = async (appId, newStatus) => {
    try {
      await api(`/api/employment-applications/${appId}/status?status=${newStatus}`, { method: 'PUT' });
      toast.success(`Status updated to ${APPLICATION_STATUS_CONFIG[newStatus]?.label || newStatus}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const openConvertModal = (app) => {
    setSelectedApplication(app);
    setConvertData({
      store_id: app.preferred_store || '',
      date_of_joining: app.expected_start_date || '',
      salary: app.expected_salary || '',
      employment_type: 'full-time',
      employee_code: ''
    });
    setShowConvertModal(true);
  };

  const handleConvertToEmployee = async () => {
    try {
      await api(`/api/employment-applications/${selectedApplication.id}/convert-to-employee`, {
        method: 'POST',
        body: JSON.stringify(convertData)
      });
      toast.success('Application converted to employee successfully');
      setShowConvertModal(false);
      setSelectedApplication(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to convert application');
    }
  };

  const deleteApplication = async (appId) => {
    if (!window.confirm('Are you sure you want to delete this application?')) return;
    try {
      await api(`/api/employment-applications/${appId}`, { method: 'DELETE' });
      toast.success('Application deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete application');
    }
  };

  // Delete employee (soft delete - moves to recycle bin) - Requires re-auth
  const deleteEmployee = async (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    requireSensitiveAuth(
      'delete',
      `Delete employee "${employee?.name || 'Unknown'}"? This will move them to the Recycle Bin.`,
      async () => {
        setDeleteLoading(true);
        try {
          await api(`/api/employees/${employeeId}`, { method: 'DELETE' });
          toast.success('Employee moved to Recycle Bin');
          setShowDeleteConfirm(null);
          fetchData();
        } catch (err) {
          toast.error('Failed to delete employee');
        } finally {
          setDeleteLoading(false);
        }
      }
    );
  };

  const downloadApplicationPDF = async (app) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 20;
    
    toast.loading('Generating PDF...', { id: 'app-pdf' });
    
    // Salary config
    const SALARY_CONFIG = {
      monthly_salary: app.salary_info?.monthly_salary || app.expected_salary || 12000,
      fixed_salary: app.salary_info?.fixed_salary || 9396,
      daily_allowance_rate: app.salary_info?.daily_allowance_rate || 100,
      working_days: app.salary_info?.working_days || 26,
      casual_leave_days: 4
    };
    
    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('EMPLOYEE APPLICATION FORM', pageWidth / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text('7-Day Free Trial Period', pageWidth / 2, y, { align: 'center' });
    y += 12;
    
    // Helper functions
    const drawSection = (title, yPos) => {
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'S');
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(title, margin + 3, yPos + 5.5);
      return yPos + 12;
    };
    
    const addField = (label, value, yPos) => {
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`${label}:`, margin + 3, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(value || '', margin + 45, yPos);
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin + 45, yPos + 1, pageWidth - margin - 3, yPos + 1);
      doc.setLineDashPattern([], 0);
      return yPos + 8;
    };
    
    const getStoreName = (storeId) => {
      const store = stores.find(s => s.id === storeId);
      return store?.name || storeId || '';
    };
    
    // Applicant Details
    y = drawSection('Applicant Details', y);
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 48, 'S');
    y += 2;
    y = addField('Name', app.full_name, y);
    y = addField('DOB', app.date_of_birth || '', y);
    y = addField('Address', app.address, y);
    y = addField('Contact', app.contact_number, y);
    y = addField('Email', app.email, y);
    y += 8;
    
    // Job Details
    y = drawSection('Job Details', y);
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 40, 'S');
    y += 2;
    y = addField('Position', app.position_applied, y);
    y = addField('Department', app.department, y);
    y = addField('Location', getStoreName(app.preferred_store), y);
    y = addField('Proposed Joining Date', app.expected_start_date || '', y);
    y += 8;
    
    // 7-Day Trial Period Box
    doc.setDrawColor(66, 133, 244);
    doc.setFillColor(232, 244, 253);
    doc.rect(margin, y, pageWidth - margin * 2, 35, 'FD');
    y += 6;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(66, 133, 244);
    doc.text('7-Day Trial Period', margin + 3, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('The first 7 days from joining are a trial period.', margin + 3, y);
    y += 5;
    doc.text('• Employee may leave anytime without penalty.', margin + 5, y);
    y += 5;
    doc.text('• Employer may end engagement anytime without liability.', margin + 5, y);
    y += 6;
    doc.text('Successful completion of 7 days leads to formal enrollment under standard employment terms.', margin + 3, y);
    y += 15;
    
    // Page 2
    doc.addPage();
    y = 20;
    
    // Salary Information
    y = drawSection('Salary Information (Upon Enrollment)', y);
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 85, 'S');
    y += 2;
    
    y = addField('Monthly Salary', `${currencySymbol}${SALARY_CONFIG.monthly_salary.toLocaleString('en-IN')}`, y);
    y = addField('Fixed Salary', `${currencySymbol}${SALARY_CONFIG.fixed_salary.toLocaleString('en-IN')}`, y);
    y = addField('Daily Allowance', `${currencySymbol}${(SALARY_CONFIG.daily_allowance_rate * SALARY_CONFIG.working_days).toLocaleString('en-IN')} (${currencySymbol}${SALARY_CONFIG.daily_allowance_rate} × ${SALARY_CONFIG.working_days} working days)`, y);
    y = addField('Payment Date', 'Between 10th and 15th of following month', y);
    y += 3;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Month Calculation:', margin + 3, y);
    y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`• ${SALARY_CONFIG.working_days} working days`, margin + 5, y);
    y += 4;
    doc.text(`• ${SALARY_CONFIG.casual_leave_days} days casual leave (paid)`, margin + 5, y);
    y += 4;
    doc.text('• Remaining days are holidays/Eids in the year', margin + 5, y);
    y += 6;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Daily Allowance Policy:', margin + 3, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(' The daily allowance is paid only for actual working days.', margin + 48, y);
    y += 6;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Absence Deduction:', margin + 3, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(' If the employee is absent beyond the allowed leave, salary will be deducted from both:', margin + 42, y);
    y += 5;
    doc.text('• the fixed salary, and', margin + 5, y);
    y += 4;
    doc.text('• the daily allowance,', margin + 5, y);
    y += 5;
    doc.text('according to the number of extra absent days.', margin + 3, y);
    y += 12;
    
    // Declaration
    doc.setFillColor(255, 248, 225);
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, pageWidth - margin * 2, 18, 'FD');
    y += 6;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Declaration', margin + 3, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('I confirm that the information above is correct and I accept the terms of the 7-day trial.', margin + 3, y);
    y += 15;
    
    // Signature lines
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 70, y);
    doc.line(pageWidth / 2 + 10, y, pageWidth - margin, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'italic');
    doc.text('Applicant Signature', margin, y);
    doc.text('Date', pageWidth / 2 + 10, y);
    y += 15;
    
    // For Office Use Only
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, pageWidth - margin * 2, 50, 'FD');
    y += 2;
    doc.setLineWidth(1.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('For Office Use Only', margin + 3, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.setLineWidth(0.3);
    y = addField('Trial Start Date', app.trial_start_date || '', y);
    y = addField('Trial End Date', app.trial_end_date || '', y);
    
    doc.setFont(undefined, 'bold');
    doc.text('Status After Trial:', margin + 3, y);
    doc.rect(margin + 45, y - 3.5, 4, 4);
    if (app.status_after_trial === 'enrolled') {
      doc.text('X', margin + 45.5, y - 0.5);
    }
    doc.setFont(undefined, 'normal');
    doc.text('Enrolled', margin + 52, y);
    doc.rect(margin + 80, y - 3.5, 4, 4);
    if (app.status_after_trial === 'not_enrolled') {
      doc.text('X', margin + 80.5, y - 0.5);
    }
    doc.text('Not Enrolled', margin + 87, y);
    y += 8;
    
    y = addField('Authorized Signatory', app.authorized_signatory || '', y);
    
    // Step 2: Add attached documents section
    try {
      const appDocs = await api(`/api/employment-applications/${app.id}/documents`);
      
      if (appDocs && appDocs.length > 0) {
        // Add new page for documents
        doc.addPage();
        y = 20;
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('ATTACHED DOCUMENTS', pageWidth / 2, y, { align: 'center' });
        y += 10;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Total documents: ${appDocs.length}`, pageWidth / 2, y, { align: 'center' });
        y += 15;
        
        for (const appDoc of appDocs) {
          const docType = appDoc.document_type || appDoc.original_filename || 'Document';
          const isImage = ['image/jpeg', 'image/jpg', 'image/png'].includes(appDoc.content_type);
          
          // Document header
          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
          doc.text(`• ${docType.replace(/_/g, ' ').toUpperCase()}`, margin, y);
          y += 5;
          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.text(`File: ${appDoc.original_filename || 'document'}`, margin + 5, y);
          y += 8;
          
          // Try to embed image documents
          if (isImage && appDoc.file_url) {
            try {
              const imgResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}${appDoc.file_url}`);
              if (imgResponse.ok) {
                const blob = await imgResponse.blob();
                const reader = new FileReader();
                const imgData = await new Promise((resolve, reject) => {
                  reader.onload = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
                
                const img = new Image();
                await new Promise((resolve) => {
                  img.onload = resolve;
                  img.src = imgData;
                });
                
                const maxWidth = pageWidth - margin * 2;
                const maxHeight = pageHeight - y - 30;
                let imgW = img.width * 0.264583;
                let imgH = img.height * 0.264583;
                
                if (imgW > maxWidth) {
                  const scale = maxWidth / imgW;
                  imgW = maxWidth;
                  imgH *= scale;
                }
                if (imgH > maxHeight) {
                  const scale = maxHeight / imgH;
                  imgH = maxHeight;
                  imgW *= scale;
                }
                
                if (y + imgH > pageHeight - 20) {
                  doc.addPage();
                  y = 20;
                }
                
                doc.addImage(imgData, 'JPEG', margin, y, imgW, imgH);
                y += imgH + 15;
              }
            } catch (imgErr) {
              doc.setFontSize(9);
              doc.setTextColor(150, 150, 150);
              doc.text('(Image could not be embedded)', margin + 5, y);
              doc.setTextColor(0, 0, 0);
              y += 10;
            }
          } else {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text('(PDF - see separate attachment)', margin + 5, y);
            doc.setTextColor(0, 0, 0);
            y += 10;
          }
          
          if (y > pageHeight - 50) {
            doc.addPage();
            y = 20;
          }
        }
      }
    } catch (docErr) {
      console.warn('Could not fetch application documents:', docErr);
    }
    
    doc.save(`Employee_Application_${app.full_name?.replace(/\s+/g, '_') || 'Form'}.pdf`);
    toast.success('PDF downloaded with documents', { id: 'app-pdf' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const pendingCount = applications.filter(a => a.status === 'pending_review' || a.status === 'under_review').length;

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="employees-page">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4">
          <TabsList className="w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="employees" className="text-xs sm:text-sm">
              <UserCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Employees</span>
              <span className="xs:hidden">Emp</span>
              <span className="ml-1">({employees.length})</span>
            </TabsTrigger>
            <TabsTrigger value="applications" className="relative text-xs sm:text-sm">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Applications</span>
              <span className="xs:hidden">Apps</span>
              <span className="ml-1">({applications.length})</span>
              {pendingCount > 0 && (
                <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full bg-red-500 text-white">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2 w-full sm:w-auto">
            {activeTab === 'applications' && (
              <Button variant="outline" onClick={() => setShowApplicationForm(true)} className="flex-1 sm:flex-none text-xs sm:text-sm h-8 sm:h-9" data-testid="new-application-btn">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> 
                <span className="hidden sm:inline">New Application</span>
                <span className="sm:hidden">New App</span>
              </Button>
            )}
            {activeTab === 'employees' && canPerformAction('employees', 'create') && (
              <Button onClick={async () => { 
                setEditEmployee(null); 
                resetForm(); 
                const nextCode = await fetchNextEmployeeCode();
                setForm(prev => ({ ...prev, employee_code: nextCode }));
                setShowModal(true); 
              }} className="flex-1 sm:flex-none text-xs sm:text-sm h-8 sm:h-9" data-testid="add-employee-btn">
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> 
                <span className="hidden sm:inline">Add Employee</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </div>

        {/* Employees Tab */}
        <TabsContent value="employees">
          {loading ? (
            <div className="flex justify-center py-8 sm:py-12">
              <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : employees.length === 0 ? (
            <Card>
              <CardContent className="py-8 sm:py-12 text-center">
                <UserCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-muted-foreground">No employees found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {employees.map((emp) => (
                <Card key={emp.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-3 sm:pt-6 sm:px-6">
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent flex items-center justify-center text-base sm:text-lg font-bold">
                        {emp.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <Badge variant={emp.is_active !== false ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                        {emp.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-sm sm:text-lg truncate">{emp.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground font-mono-data">{emp.employee_code}</p>
                    <p className="text-xs sm:text-sm capitalize truncate">{emp.designation || emp.department}</p>
                    
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate">{getStoreName(emp.store_id)}</span>
                    </div>
                    {emp.phone && (
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1 text-xs sm:text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="font-mono-data">{emp.phone}</span>
                  </div>
                )}
                {emp.email && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{emp.email}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t border-border flex-wrap">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => fetchEmployeeProfile(emp.id)} data-testid={`view-profile-btn-${emp.id}`}>
                    <Eye className="w-3 h-3 mr-1" /> Profile
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowIDCard(emp.id)} data-testid={`id-card-btn-${emp.id}`}>
                    <IdCard className="w-3 h-3 mr-1" /> ID Card
                  </Button>
                  {canPerformAction('payroll', 'edit') && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => openUpgradeModal(emp)}
                      data-testid={`upgrade-btn-${emp.id}`}
                    >
                      <TrendingUp className="w-3 h-3 mr-1" /> Upgrade
                    </Button>
                  )}
                  {canPerformAction('employees', 'edit') && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(emp)}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  )}
                  {canPerformAction('employees', 'delete') && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setShowDeleteConfirm(emp)}
                      data-testid={`delete-employee-btn-${emp.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
          )}

        {/* Employee ID Card Dialog */}
        <EmployeeIDCard 
          employeeId={showIDCard} 
          onClose={() => setShowIDCard(null)} 
        />
        </TabsContent>

        {/* Applications Tab */}
        <TabsContent value="applications">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No applications found</p>
                <Button className="mt-4" onClick={() => setShowApplicationForm(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create First Application
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => {
                const statusConfig = APPLICATION_STATUS_CONFIG[app.status] || APPLICATION_STATUS_CONFIG.pending_review;
                const StatusIcon = statusConfig.icon;
                return (
                  <Card key={app.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-lg font-bold">
                            {app.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{app.full_name || 'Unnamed'}</h3>
                            <p className="text-sm text-muted-foreground">
                              Applied for: <span className="font-medium">{app.position_applied || 'N/A'}</span>
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {app.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{app.email}</span>}
                              {app.contact_number && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{app.contact_number}</span>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">Applied: {formatDate(app.submitted_at || app.created_at)}</p>
                            {app.expected_start_date && (
                              <p className="text-muted-foreground">Start: {formatDate(app.expected_start_date)}</p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Edit Application button */}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => openEditApplication(app)}
                              data-testid={`edit-app-btn-${app.id}`}
                            >
                              <Edit className="w-3 h-3 mr-1" /> Edit
                            </Button>
                            {/* Download PDF button - always visible */}
                            <Button size="sm" variant="outline" onClick={() => downloadApplicationPDF(app)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200" data-testid="download-app-pdf-btn">
                              <Download className="w-3 h-3 mr-1" /> PDF
                            </Button>
                            {app.status === 'pending_review' && (
                              <Button size="sm" variant="outline" onClick={() => updateApplicationStatus(app.id, 'under_review')}>
                                Start Review
                              </Button>
                            )}
                            {app.status === 'under_review' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => updateApplicationStatus(app.id, 'approved')}>
                                  <CheckCircle className="w-3 h-3 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => updateApplicationStatus(app.id, 'rejected')}>
                                  <XCircle className="w-3 h-3 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                            {app.status === 'approved' && (
                              <Button size="sm" onClick={() => openConvertModal(app)}>
                                <UserPlus className="w-3 h-3 mr-1" /> Convert to Employee
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => deleteApplication(app.id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Employment Application Form Modal */}
      <EmploymentApplicationForm
        isOpen={showApplicationForm}
        onClose={closeApplicationForm}
        onSubmit={fetchData}
        stores={stores}
        departments={['sales', 'operations', 'accounts', 'warehouse', 'management', 'general']}
        editApplication={editingApplication}
      />

      {/* Convert to Employee Modal */}
      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Application to Employee</DialogTitle>
            <DialogDescription>
              Complete the following details to create an employee record for {selectedApplication?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee Code</Label>
              <Input
                value={convertData.employee_code}
                onChange={(e) => setConvertData({ ...convertData, employee_code: e.target.value })}
                placeholder="e.g., EMP001"
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned Store</Label>
              <Select value={convertData.store_id} onValueChange={(v) => setConvertData({ ...convertData, store_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Joining</Label>
                <Input
                  type="date"
                  value={convertData.date_of_joining}
                  onChange={(e) => setConvertData({ ...convertData, date_of_joining: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Salary</Label>
                <Input
                  type="number"
                  value={convertData.salary}
                  onChange={(e) => setConvertData({ ...convertData, salary: e.target.value })}
                  placeholder="Monthly salary"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select value={convertData.employment_type} onValueChange={(v) => setConvertData({ ...convertData, employment_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full Time</SelectItem>
                  <SelectItem value="part-time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertModal(false)}>Cancel</Button>
            <Button onClick={handleConvertToEmployee}>Convert to Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing Employee Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
            {Object.keys(lockedFields).length > 0 && (
              <div className="flex items-center justify-between mt-2 p-2 bg-blue-50 rounded-lg text-sm">
                <span className="text-blue-700">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Fields with data are auto-filled & locked. Empty fields are editable.
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={clearAutoFill} className="text-blue-600 hover:text-blue-800">
                  Clear & Reset
                </Button>
              </div>
            )}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Employee Code & Name Row with Search */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Employee Code *
                  {lockedFields.employee_code && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                </Label>
                <Input 
                  value={form.employee_code} 
                  onChange={(e) => setForm({...form, employee_code: e.target.value})} 
                  required 
                  disabled={lockedFields.employee_code}
                  className={lockedFields.employee_code ? 'bg-gray-100' : ''}
                />
              </div>
              <div className="space-y-2 relative">
                <Label className="flex items-center gap-2">
                  Full Name *
                  {lockedFields.name && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                </Label>
                <div className="relative">
                  <Input 
                    value={form.name} 
                    onChange={(e) => {
                      setForm({...form, name: e.target.value});
                      if (!editEmployee) {
                        searchByName(e.target.value);
                      }
                    }}
                    onFocus={() => form.name && !editEmployee && searchByName(form.name)}
                    onBlur={() => setTimeout(() => setShowSearchResults(false), 300)}
                    required 
                    disabled={lockedFields.name}
                    className={lockedFields.name ? 'bg-gray-100' : ''}
                    placeholder="Type to search existing employees/applications..."
                  />
                  {/* Search Results Dropdown */}
                  {showSearchResults && searchResults.length > 0 && (
                    <div 
                      className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <div className="p-2 text-xs text-muted-foreground bg-gray-50 border-b">
                        Click to auto-fill available data
                      </div>
                      {searchResults.map((result, idx) => (
                        <div 
                          key={idx}
                          className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0 transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            autoFillFromSelection(result);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{result.name || result.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {result.source === 'employee' ? (
                                  <><Badge variant="outline" className="mr-1">{result.employee_code}</Badge> {result.designation || 'Employee'}</>
                                ) : (
                                  <>Applied for: {result.position_applied || 'N/A'}</>
                                )}
                              </p>
                            </div>
                            <Badge variant={result.source === 'employee' ? 'default' : 'secondary'}>
                              {result.source === 'employee' ? 'Employee' : 'Application'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Email
                  {lockedFields.email && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                </Label>
                <Input 
                  type="email" 
                  value={form.email} 
                  onChange={(e) => setForm({...form, email: e.target.value})} 
                  disabled={lockedFields.email}
                  className={lockedFields.email ? 'bg-gray-100' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Phone
                  {lockedFields.phone && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                </Label>
                <Input 
                  value={form.phone} 
                  onChange={(e) => setForm({...form, phone: e.target.value})} 
                  disabled={lockedFields.phone}
                  className={lockedFields.phone ? 'bg-gray-100' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Store *
                  {lockedFields.store_id && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                </Label>
                <Select 
                  value={form.store_id} 
                  onValueChange={(v) => setForm({...form, store_id: v})}
                  disabled={lockedFields.store_id}
                >
                  <SelectTrigger className={lockedFields.store_id ? 'bg-gray-100' : ''}>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Department
                  {lockedFields.department && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                </Label>
                <Select 
                  value={form.department} 
                  onValueChange={(v) => setForm({...form, department: v})}
                  disabled={lockedFields.department}
                >
                  <SelectTrigger className={lockedFields.department ? 'bg-gray-100' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="inventory">Inventory</SelectItem>
                    <SelectItem value="accounts">Accounts</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="management">Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Designation
                  {lockedFields.designation && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                </Label>
                <Input 
                  value={form.designation} 
                  onChange={(e) => setForm({...form, designation: e.target.value})} 
                  disabled={lockedFields.designation}
                  className={lockedFields.designation ? 'bg-gray-100' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Date of Joining
                  {lockedFields.date_of_joining && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                </Label>
                <Input 
                  type="date" 
                  value={form.date_of_joining} 
                  onChange={(e) => setForm({...form, date_of_joining: e.target.value})} 
                  disabled={lockedFields.date_of_joining}
                  className={lockedFields.date_of_joining ? 'bg-gray-100' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Gender
                  {lockedFields.gender && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                </Label>
                <Select 
                  value={form.gender} 
                  onValueChange={(v) => setForm({...form, gender: v})}
                  disabled={lockedFields.gender}
                >
                  <SelectTrigger className={lockedFields.gender ? 'bg-gray-100' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Address
                  {lockedFields.address && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                </Label>
                <Input 
                  value={form.address} 
                  onChange={(e) => setForm({...form, address: e.target.value})} 
                  disabled={lockedFields.address}
                  className={lockedFields.address ? 'bg-gray-100' : ''}
                />
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Bank Details</h4>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Bank Account
                    {lockedFields.bank_account && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                  </Label>
                  <Input 
                    value={form.bank_account} 
                    onChange={(e) => setForm({...form, bank_account: e.target.value})} 
                    disabled={lockedFields.bank_account}
                    className={lockedFields.bank_account ? 'bg-gray-100' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Bank Name
                    {lockedFields.bank_name && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                  </Label>
                  <Input 
                    value={form.bank_name} 
                    onChange={(e) => setForm({...form, bank_name: e.target.value})} 
                    disabled={lockedFields.bank_name}
                    className={lockedFields.bank_name ? 'bg-gray-100' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    IFSC Code
                    {lockedFields.ifsc_code && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                  </Label>
                  <Input 
                    value={form.ifsc_code} 
                    onChange={(e) => setForm({...form, ifsc_code: e.target.value})} 
                    disabled={lockedFields.ifsc_code}
                    className={lockedFields.ifsc_code ? 'bg-gray-100' : ''}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">ID Proofs</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    PAN Number
                    {lockedFields.pan_number && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                  </Label>
                  <Input 
                    value={form.pan_number} 
                    onChange={(e) => setForm({...form, pan_number: e.target.value})} 
                    disabled={lockedFields.pan_number}
                    className={lockedFields.pan_number ? 'bg-gray-100' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Aadhar Number
                    {lockedFields.aadhar_number && <Badge variant="secondary" className="text-xs">Auto-filled</Badge>}
                  </Label>
                  <Input 
                    value={form.aadhar_number} 
                    onChange={(e) => setForm({...form, aadhar_number: e.target.value})} 
                    disabled={lockedFields.aadhar_number}
                    className={lockedFields.aadhar_number ? 'bg-gray-100' : ''}
                  />
                </div>
              </div>
            </div>

            {/* Document Upload Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Employee Documents
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                Upload Aadhar Card, PAN Card, Qualification Certificate, and Guardian Consent Letter (PDF, JPG, PNG - Max 5MB each)
              </p>
              
              {/* Existing Documents (when editing) */}
              {editEmployee && uploadedDocs.length > 0 && (
                <div className="mb-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-800 mb-2">Uploaded Documents:</p>
                  <div className="flex flex-wrap gap-2">
                    {uploadedDocs.map((doc, idx) => (
                      <Badge key={idx} variant="outline" className="bg-white">
                        <FileCheck className="w-3 h-3 mr-1 text-green-600" />
                        {doc.document_type || doc.original_filename}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Aadhar Card Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <IdCard className="w-4 h-4 text-blue-600" />
                    Aadhar Card *
                  </Label>
                  <input
                    ref={aadharInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentSelect('aadhar_card', e.target.files[0])}
                    className="hidden"
                  />
                  {documents.aadhar_card ? (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <File className="w-4 h-4 text-blue-600" />
                      <span className="text-sm flex-1 truncate">{documents.aadhar_card.name}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeDocument('aadhar_card')}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => aadharInputRef.current?.click()}
                      disabled={uploadingDoc === 'aadhar_card'}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingDoc === 'aadhar_card' ? 'Uploading...' : 'Choose Aadhar Card File'}
                    </Button>
                  )}
                </div>

                {/* PAN Card Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-600" />
                    PAN Card *
                  </Label>
                  <input
                    ref={panInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentSelect('pan_card', e.target.files[0])}
                    className="hidden"
                  />
                  {documents.pan_card ? (
                    <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
                      <File className="w-4 h-4 text-orange-600" />
                      <span className="text-sm flex-1 truncate">{documents.pan_card.name}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeDocument('pan_card')}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => panInputRef.current?.click()}
                      disabled={uploadingDoc === 'pan_card'}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingDoc === 'pan_card' ? 'Uploading...' : 'Choose PAN Card File'}
                    </Button>
                  )}
                </div>

                {/* Qualification Certificate Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-green-600" />
                    Qualification Certificate
                  </Label>
                  <input
                    ref={qualificationInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentSelect('qualification_certificate', e.target.files[0])}
                    className="hidden"
                  />
                  {documents.qualification_certificate ? (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                      <File className="w-4 h-4 text-green-600" />
                      <span className="text-sm flex-1 truncate">{documents.qualification_certificate.name}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeDocument('qualification_certificate')}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => qualificationInputRef.current?.click()}
                      disabled={uploadingDoc === 'qualification_certificate'}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingDoc === 'qualification_certificate' ? 'Uploading...' : 'Choose Certificate File'}
                    </Button>
                  )}
                </div>

                {/* Guardian Consent Letter Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Guardian/Father Consent Letter
                  </Label>
                  <input
                    ref={consentInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentSelect('guardian_consent_letter', e.target.files[0])}
                    className="hidden"
                  />
                  {documents.guardian_consent_letter ? (
                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
                      <File className="w-4 h-4 text-purple-600" />
                      <span className="text-sm flex-1 truncate">{documents.guardian_consent_letter.name}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeDocument('guardian_consent_letter')}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => consentInputRef.current?.click()}
                      disabled={uploadingDoc === 'guardian_consent_letter'}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingDoc === 'guardian_consent_letter' ? 'Uploading...' : 'Choose Consent Letter'}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => { setShowModal(false); setLockedFields({}); }}>Cancel</Button>
              <Button type="submit">{editEmployee ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Employee Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="employee-profile-modal">
          <DialogHeader>
            <DialogTitle className="text-xl">Employee Profile</DialogTitle>
          </DialogHeader>
          
          {profileLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : employeeProfile ? (
            <div className="space-y-6">
              {/* Header with basic info */}
              <div className="flex items-start gap-4 p-4 bg-accent/20 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                  {employeeProfile.employee?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{employeeProfile.employee?.name}</h2>
                    <Badge variant={employeeProfile.employee?.is_active ? 'default' : 'secondary'}>
                      {employeeProfile.employee?.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    <Badge variant="outline" className="mr-2">{employeeProfile.employee?.employee_code}</Badge>
                    {employeeProfile.employee?.designation || 'No designation'}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    {employeeProfile.employee?.department && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {employeeProfile.employee?.department}
                      </span>
                    )}
                    {employeeProfile.store && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {employeeProfile.store?.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{employeeProfile.attendance_summary?.present || 0}</p>
                    <p className="text-xs text-muted-foreground">Present (30d)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{employeeProfile.attendance_summary?.absent || 0}</p>
                    <p className="text-xs text-muted-foreground">Absent (30d)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{employeeProfile.performance?.average_rating || 0}/5</p>
                    <p className="text-xs text-muted-foreground">Avg Rating</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {currencySymbol}{(employeeProfile.salary?.structure?.basic_salary || employeeProfile.employee?.salary || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-muted-foreground">Salary</p>
                  </CardContent>
                </Card>
              </div>

              {/* Details Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Contact Info */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Phone className="w-4 h-4" /> Contact Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{employeeProfile.employee?.phone || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span>{employeeProfile.employee?.email || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address</span>
                        <span className="text-right max-w-[200px]">{employeeProfile.employee?.address || 'N/A'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Employment Info */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Employment Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date of Joining</span>
                        <span>{employeeProfile.employee?.date_of_joining || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Department</span>
                        <span>{employeeProfile.employee?.department || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Designation</span>
                        <span>{employeeProfile.employee?.designation || 'N/A'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => {
                  setShowProfileModal(false);
                  openEdit(employeeProfile.employee);
                }}>
                  <Edit className="w-4 h-4 mr-2" /> Edit Employee
                </Button>
                <Button onClick={() => setShowProfileModal(false)}>Close</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Employee data not available
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Employee
            </DialogTitle>
          </DialogHeader>
          
          {showDeleteConfirm && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  Are you sure you want to delete <strong>{showDeleteConfirm.name}</strong>?
                </p>
                <p className="text-xs text-red-600 mt-2">
                  This employee will be moved to the Recycle Bin and can be restored within 30 days.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm"><strong>Employee Code:</strong> {showDeleteConfirm.employee_code}</p>
                <p className="text-sm"><strong>Department:</strong> {showDeleteConfirm.department || 'N/A'}</p>
                <p className="text-sm"><strong>Store:</strong> {stores.find(s => s.id === showDeleteConfirm.store_id)?.name || 'N/A'}</p>
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => deleteEmployee(showDeleteConfirm.id)}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Employee'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Employee Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Upgrade Employee
            </DialogTitle>
            <DialogDescription>
              Update designation and salary for {upgradeEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current Info */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Current Status</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Designation:</span>
                  <p className="font-medium">{upgradeEmployee?.designation || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Basic Salary:</span>
                  <p className="font-medium">{currencySymbol}{(upgradeEmployee?.salary_info?.basic_salary || upgradeEmployee?.salary || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            {/* New Values */}
            <div className="space-y-2">
              <Label>New Designation *</Label>
              <Input
                value={upgradeForm.designation}
                onChange={(e) => setUpgradeForm({ ...upgradeForm, designation: e.target.value })}
                placeholder="e.g., Senior Manager, Team Lead"
                data-testid="upgrade-designation-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label>New Basic Salary ({currencySymbol}) *</Label>
              <Input
                type="number"
                value={upgradeForm.basic_salary}
                onChange={(e) => setUpgradeForm({ ...upgradeForm, basic_salary: e.target.value })}
                placeholder="Enter new salary"
                data-testid="upgrade-salary-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={upgradeForm.effective_date}
                onChange={(e) => setUpgradeForm({ ...upgradeForm, effective_date: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Reason / Notes</Label>
              <Textarea
                value={upgradeForm.reason}
                onChange={(e) => setUpgradeForm({ ...upgradeForm, reason: e.target.value })}
                placeholder="e.g., Annual increment, Promotion"
                rows={2}
              />
            </div>
            
            {/* Upgrade History */}
            {upgradeHistory.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Upgrade History</h4>
                <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                  {upgradeHistory.map((hist, idx) => (
                    <div key={idx} className="p-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{hist.new_designation}</span>
                        <span className="text-muted-foreground">
                          {new Date(hist.effective_date || hist.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {hist.previous_designation} → {hist.new_designation} | 
                        {currencySymbol}{hist.previous_salary?.toLocaleString()} → {currencySymbol}{hist.new_salary?.toLocaleString()}
                      </div>
                      {hist.reason && (
                        <p className="text-xs text-gray-500 mt-1">{hist.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeModal(false)}>Cancel</Button>
            <Button 
              onClick={handleUpgradeSubmit}
              disabled={upgradeLoading || !upgradeForm.designation || !upgradeForm.basic_salary}
              className="bg-green-600 hover:bg-green-700"
              data-testid="submit-upgrade-btn"
            >
              {upgradeLoading ? 'Upgrading...' : 'Upgrade Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
