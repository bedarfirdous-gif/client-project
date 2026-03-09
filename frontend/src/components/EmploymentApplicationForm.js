import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { Download, User, IndianRupee, Calendar, Briefcase, FileText, CheckCircle, Upload, File, X as XIcon, IdCard, FileCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent} from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import jsPDF from 'jspdf';

const TRIAL_PERIOD_DAYS = 7;

export default function EmploymentApplicationForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  departments = [],
  stores = [],
  employees = [],
  editApplication = null  // Add edit mode support
}) {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [fillColor, setFillColor] = useState(false);
  const [font, setFont] = useState(false);
  const [fontSize, setFontSize] = useState(false);
  const [form, setForm] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
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
  
  // Default form state with ALL fields
  const defaultFormData = {
    // Applicant Details
    name: '',
    dob: '',
    address: '',
    contact: '',
    email: '',
    
    // Job Details
    position: '',
    department: '',
    location: '',
    proposed_joining_date: '',
    
    // Salary Information - EDITABLE
    monthly_salary: 12000,
    fixed_salary: 9396,
    daily_allowance_rate: 100,
    working_days: 26,
    payment_date_start: 10,
    payment_date_end: 15,
    
    // Declaration
    declaration_agreed: false,
    applicant_signature: '',
    signature_date: '',
    
    // For Office Use Only
    trial_start_date: '',
    trial_end_date: '',
    status_after_trial: '',
    authorized_signatory: ''
  };
  
  // Form state with ALL fields
  const [formData, setFormData] = useState(defaultFormData);

  // Populate form when editing
  useEffect(() => {
    if (editApplication && isOpen) {
      setFormData({
        name: editApplication.full_name || '',
        dob: editApplication.date_of_birth || '',
        address: editApplication.address || '',
        contact: editApplication.contact_number || '',
        email: editApplication.email || '',
        position: editApplication.position_applied || '',
        department: editApplication.department || '',
        location: editApplication.location || '',
        proposed_joining_date: editApplication.expected_start_date || '',
        monthly_salary: editApplication.proposed_salary || 12000,
        fixed_salary: editApplication.fixed_salary || 9396,
        daily_allowance_rate: editApplication.daily_allowance_rate || 100,
        working_days: editApplication.working_days || 26,
        payment_date_start: editApplication.payment_date_start || 10,
        payment_date_end: editApplication.payment_date_end || 15,
        declaration_agreed: editApplication.declaration_agreed || false,
        applicant_signature: editApplication.applicant_signature || '',
        signature_date: editApplication.signature_date || '',
        trial_start_date: editApplication.trial_start_date || '',
        trial_end_date: editApplication.trial_end_date || '',
        status_after_trial: editApplication.status_after_trial || '',
        authorized_signatory: editApplication.authorized_signatory || ''
      });
    } else if (!editApplication && isOpen) {
      setFormData(defaultFormData);
    }
  }, [editApplication, isOpen]);

  // Fetch employees when form opens
  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    try {
      const data = await api('/api/employees');
      setAllEmployees(data || []);
    } catch (err) {
      console.error('Failed to fetch employees');
      setAllEmployees([]);
    }
  };

  // Search employees by name
  const searchByName = (name) => {
    if (!name || name.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    const searchTerm = name.toLowerCase();
    const matched = allEmployees.filter(emp => 
      emp.name?.toLowerCase().includes(searchTerm) ||
      emp.employee_code?.toLowerCase().includes(searchTerm)
    );
    
    setSearchResults(matched);
    setShowSearchResults(matched.length > 0);
  };

  // Auto-fill from selected employee
  const autoFillFromEmployee = (employee) => {
    setFormData(prev => ({
      ...prev,
      name: employee.name || '',
      dob: employee.date_of_birth || '',
      address: employee.address || '',
      contact: employee.phone || '',
      email: employee.email || '',
      position: employee.designation || '',
      department: employee.department || '',
      location: employee.store_id || ''
    }));
    setShowSearchResults(false);
    toast.success(`Loaded data for ${employee.name}`);
  };

  // Calculate daily allowance
  const dailyAllowance = formData.daily_allowance_rate * formData.working_days;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSalaryChange = (field, value) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  // Document Upload Functions
  const handleDocumentSelect = (docType, file) => {
    if (!file) return;
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Allowed: PDF, JPG, PNG');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size: 5MB');
      return;
    }
    
    setDocuments(prev => ({ ...prev, [docType]: file }));
  };

  const removeDocument = (docType) => {
    setDocuments(prev => ({ ...prev, [docType]: null }));
  };

  const uploadApplicationDocuments = async (applicationId) => {
    const docsToUpload = Object.entries(documents).filter(([_, file]) => file !== null);
    
    for (const [docType, file] of docsToUpload) {
      setUploadingDoc(docType);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', docType);
        
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/employment-applications/${applicationId}/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });
      } catch (err) {
        console.error(`Failed to upload ${docType}:`, err);
      }
    }
    setUploadingDoc(null);
  };

  const validateForm = () => {
    if (!formData.name?.trim()) {
      toast.error('Name is required');
      return false;
    }
    if (!formData.contact?.trim()) {
      toast.error('Contact number is required');
      return false;
    }
    if (!formData.position?.trim()) {
      toast.error('Position is required');
      return false;
    }
    if (!formData.declaration_agreed) {
      toast.error('Please agree to the declaration');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const applicationData = {
        full_name: formData.name,
        date_of_birth: formData.dob,
        address: formData.address,
        contact_number: formData.contact,
        email: formData.email,
        position_applied: formData.position,
        department: formData.department,
        preferred_store: formData.location,
        expected_start_date: formData.proposed_joining_date,
        expected_salary: formData.monthly_salary,
        trial_period_days: TRIAL_PERIOD_DAYS,
        salary_info: {
          monthly_salary: formData.monthly_salary,
          fixed_salary: formData.fixed_salary,
          daily_allowance: dailyAllowance,
          daily_allowance_rate: formData.daily_allowance_rate,
          working_days: formData.working_days,
          payment_date_start: formData.payment_date_start,
          payment_date_end: formData.payment_date_end
        },
        declaration_agreed: formData.declaration_agreed,
        applicant_signature: formData.applicant_signature,
        signature_date: formData.signature_date,
        // Office use fields
        trial_start_date: formData.trial_start_date,
        trial_end_date: formData.trial_end_date,
        status_after_trial: formData.status_after_trial,
        authorized_signatory: formData.authorized_signatory
      };
      
      let applicationId = editApplication?.id;
      
      if (editApplication) {
        // Update existing application
        await api(`/api/employment-applications/${editApplication.id}`, {
          method: 'PUT',
          body: JSON.stringify(applicationData)
        });
        toast.success('Application updated successfully');
      } else {
        // Create new application
        applicationData.status = 'pending_review';
        applicationData.application_id = `APP-${Date.now()}`;
        applicationData.submitted_at = new Date().toISOString();
        
        const response = await api('/api/employment-applications', {
          method: 'POST',
          body: JSON.stringify(applicationData)
        });
        applicationId = response.id;
        toast.success('Application submitted successfully');
      }
      
      // Upload documents if any selected
      const hasDocuments = Object.values(documents).some(doc => doc !== null);
      if (hasDocuments && applicationId) {
        toast.info('Uploading documents...');
        await uploadApplicationDocuments(applicationId);
        toast.success('Documents uploaded successfully');
      }
      
      onSubmit?.(applicationData);
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to submit application:', err);
      toast.error(editApplication ? 'Failed to update application' : 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', dob: '', address: '', contact: '', email: '',
      position: '', department: '', location: '', proposed_joining_date: '',
      monthly_salary: 12000, fixed_salary: 9396, daily_allowance_rate: 100,
      working_days: 26, payment_date_start: 10, payment_date_end: 15,
      declaration_agreed: false, applicant_signature: '', signature_date: '',
      trial_start_date: '', trial_end_date: '', status_after_trial: '', authorized_signatory: ''
    });
    setDocuments({
      aadhar_card: null,
      pan_card: null,
      qualification_certificate: null,
      guardian_consent_letter: null
    });
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;
    
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
      return yPos + 7;
    };
    
    // Applicant Details
    y = drawSection('Applicant Details', y);
    y = addField('Name', formData.name, y);
    y = addField('DOB', formData.dob, y);
    y = addField('Address', formData.address, y);
    y = addField('Contact', formData.contact, y);
    y = addField('Email', formData.email, y);
    y += 5;
    
    // Job Details
    y = drawSection('Job Details', y);
    y = addField('Position', formData.position, y);
    y = addField('Department', formData.department, y);
    y = addField('Joining Date', formData.proposed_joining_date, y);
    y += 5;
    
    // Page 2
    doc.addPage();
    y = 20;
    
    // Salary Information
    y = drawSection('Salary Information', y);
    y = addField('Monthly Salary', `${currencySymbol}${formData.monthly_salary.toLocaleString('en-IN')}`, y);
    y = addField('Fixed Salary', `${currencySymbol}${formData.fixed_salary.toLocaleString('en-IN')}`, y);
    y = addField('Daily Allowance', `${currencySymbol}${dailyAllowance.toLocaleString('en-IN')}`, y);
    y = addField('Payment Date', `${formData.payment_date_start}th - ${formData.payment_date_end}th`, y);
    y += 10;
    
    // Attached Documents Section
    y = drawSection('Attached Documents', y);
    const docTypes = [
      { key: 'aadhar_card', label: 'Aadhar Card' },
      { key: 'pan_card', label: 'PAN Card' },
      { key: 'qualification_certificate', label: 'Qualification Certificate' },
      { key: 'guardian_consent_letter', label: 'Guardian/Father Consent Letter' }
    ];
    
    docTypes.forEach(docType => {
      const file = documents[docType.key];
      const status = file ? `✓ ${file.name}` : '✗ Not uploaded';
      y = addField(docType.label, status, y);
    });
    
    doc.save(`Application_${formData.name?.replace(/\s+/g, '_') || 'Form'}.pdf`);
    toast.success('PDF downloaded');
  };

  const getStoreName = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    return store?.name || storeId || '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="employment-application-form-modal">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">
                {editApplication ? 'EDIT APPLICATION FORM' : 'EMPLOYEE APPLICATION FORM'}
              </DialogTitle>
              <p className="text-muted-foreground mt-1">7-Day Free Trial Period</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={downloadPDF}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700"
              data-testid="download-pdf-btn"
            >
              <Download className="w-4 h-4 mr-1" />
              Download PDF
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Applicant Details Section */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Applicant Details
              </h3>
              
              {/* Name field with search */}
              <div className="mb-4 relative">
                <Label className="text-sm font-medium">Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    handleChange('name', e.target.value);
                    searchByName(e.target.value);
                  }}
                  onFocus={() => formData.name && searchByName(formData.name)}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 300)}
                  placeholder="Type to search existing employees..."
                  className="mt-1"
                  data-testid="applicant-name-input"
                />
                
                {/* Employee Search Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div 
                    className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div className="p-2 text-xs text-gray-500 bg-gray-50 border-b font-medium">
                      Click to auto-fill employee data
                    </div>
                    {searchResults.map((emp, idx) => (
                      <div 
                        key={idx}
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          autoFillFromEmployee(emp);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{emp.name}</p>
                              <p className="text-xs text-gray-500">
                                {emp.employee_code} • {emp.designation || emp.department || 'Employee'}
                              </p>
                            </div>
                          </div>
                          <Badge variant="default">Employee</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Date of Birth (DOB)</Label>
                  <Input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => handleChange('dob', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Contact *</Label>
                  <Input
                    value={formData.contact}
                    onChange={(e) => handleChange('contact', e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Complete residential address"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="applicant@email.com"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Job Details Section */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Job Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Position *</Label>
                  <Input
                    value={formData.position}
                    onChange={(e) => handleChange('position', e.target.value)}
                    placeholder="e.g., Sales Associate"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Department</Label>
                  <Select value={formData.department} onValueChange={(v) => handleChange('department', v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="operations">Operations</SelectItem>
                      <SelectItem value="accounts">Accounts</SelectItem>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Location</Label>
                  <Select value={formData.location} onValueChange={(v) => handleChange('location', v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.length > 0 ? (
                        stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                      ) : (
                        <SelectItem value="any">Any Location</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Proposed Joining Date</Label>
                  <Input
                    type="date"
                    value={formData.proposed_joining_date}
                    onChange={(e) => handleChange('proposed_joining_date', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 7-Day Trial Period Info */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-3 text-blue-700">7-Day Trial Period</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• The first <strong>7 days</strong> from joining are a trial period.</li>
                <li>• <strong>Employee</strong> may leave anytime without penalty.</li>
                <li>• <strong>Employer</strong> may end engagement anytime without liability.</li>
                <li>• Successful completion leads to formal enrollment.</li>
              </ul>
            </CardContent>
          </Card>

          {/* Salary Information - EDITABLE */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-primary" />
                Salary Information (Upon Enrollment) - <span className="text-green-600">EDITABLE</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Monthly Salary */}
                <div className="p-4 border-2 border-gray-200 rounded-lg bg-white">
                  <Label className="text-sm text-gray-500">Monthly Salary</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg font-bold">{currencySymbol}</span>
                    <Input
                      type="number"
                      value={formData.monthly_salary}
                      onChange={(e) => handleSalaryChange('monthly_salary', e.target.value)}
                      className="text-lg font-bold h-12 border-2 focus:border-blue-500"
                      data-testid="monthly-salary-input"
                    />
                  </div>
                </div>
                
                {/* Fixed Salary */}
                <div className="p-4 border-2 border-gray-200 rounded-lg bg-white">
                  <Label className="text-sm text-gray-500">Fixed Salary</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg font-bold">{currencySymbol}</span>
                    <Input
                      type="number"
                      value={formData.fixed_salary}
                      onChange={(e) => handleSalaryChange('fixed_salary', e.target.value)}
                      className="text-lg font-bold h-12 border-2 focus:border-blue-500"
                      data-testid="fixed-salary-input"
                    />
                  </div>
                </div>
                
                {/* Daily Allowance */}
                <div className="p-4 border-2 border-gray-200 rounded-lg bg-white">
                  <Label className="text-sm text-gray-500">Daily Allowance (Auto-calculated)</Label>
                  <p className="text-2xl font-bold text-green-600 mt-2">{currencySymbol}{dailyAllowance.toLocaleString('en-IN')}</p>
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <span>{currencySymbol}</span>
                    <Input
                      type="number"
                      value={formData.daily_allowance_rate}
                      onChange={(e) => handleSalaryChange('daily_allowance_rate', e.target.value)}
                      className="w-20 h-8 border-2"
                      data-testid="daily-rate-input"
                    />
                    <span>×</span>
                    <Input
                      type="number"
                      value={formData.working_days}
                      onChange={(e) => handleSalaryChange('working_days', e.target.value)}
                      className="w-16 h-8 border-2"
                      data-testid="working-days-input"
                    />
                    <span>days</span>
                  </div>
                </div>
                
                {/* Payment Date */}
                <div className="p-4 border-2 border-gray-200 rounded-lg bg-white">
                  <Label className="text-sm text-gray-500">Payment Date Range</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      value={formData.payment_date_start}
                      onChange={(e) => handleSalaryChange('payment_date_start', e.target.value)}
                      className="w-16 h-12 text-lg font-bold border-2 text-center"
                      data-testid="payment-start-input"
                    />
                    <span className="text-lg font-bold">th -</span>
                    <Input
                      type="number"
                      value={formData.payment_date_end}
                      onChange={(e) => handleSalaryChange('payment_date_end', e.target.value)}
                      className="w-16 h-12 text-lg font-bold border-2 text-center"
                      data-testid="payment-end-input"
                    />
                    <span className="text-lg font-bold">th</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">of following month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Declaration */}
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-amber-600" />
                Declaration
              </h3>
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                <Checkbox
                  id="declaration"
                  checked={formData.declaration_agreed}
                  onCheckedChange={(checked) => handleChange('declaration_agreed', checked)}
                  data-testid="declaration-checkbox"
                />
                <label htmlFor="declaration" className="text-sm cursor-pointer">
                  I confirm that the information above is correct and I accept the terms of the 7-day trial.
                </label>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="text-sm font-medium">Applicant Signature</Label>
                  <Input
                    value={formData.applicant_signature}
                    onChange={(e) => handleChange('applicant_signature', e.target.value)}
                    placeholder="Type your full name"
                    className="mt-1 italic"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Date</Label>
                  <Input
                    type="date"
                    value={formData.signature_date}
                    onChange={(e) => handleChange('signature_date', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* For Office Use Only */}
          <Card className="bg-gray-50">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 border-b-4 border-gray-800 pb-2">
                For Office Use Only
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Trial Start Date</Label>
                  <Input
                    type="date"
                    value={formData.trial_start_date}
                    onChange={(e) => handleChange('trial_start_date', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Trial End Date</Label>
                  <Input
                    type="date"
                    value={formData.trial_end_date}
                    onChange={(e) => handleChange('trial_end_date', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Status After Trial</Label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.status_after_trial === 'enrolled'}
                        onCheckedChange={(c) => handleChange('status_after_trial', c ? 'enrolled' : '')}
                      />
                      <span>Enrolled</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.status_after_trial === 'not_enrolled'}
                        onCheckedChange={(c) => handleChange('status_after_trial', c ? 'not_enrolled' : '')}
                      />
                      <span>Not Enrolled</span>
                    </label>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Authorized Signatory</Label>
                  <Input
                    value={formData.authorized_signatory}
                    onChange={(e) => handleChange('authorized_signatory', e.target.value)}
                    placeholder="Name of authorized person"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Upload Section */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Upload Documents
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload Aadhar Card, PAN Card, Qualification Certificate, and Guardian Consent Letter (PDF, JPG, PNG - Max 5MB each)
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Aadhar Card Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <IdCard className="w-4 h-4 text-blue-600" />
                    Aadhar Card
                  </Label>
                  <input
                    ref={aadharInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentSelect('aadhar_card', e.target.files[0])}
                    className="hidden"
                  />
                  {documents.aadhar_card ? (
                    <div className="flex items-center gap-2 p-2 bg-blue-100 rounded-lg border border-blue-200">
                      <File className="w-4 h-4 text-blue-600" />
                      <span className="text-sm flex-1 truncate">{documents.aadhar_card.name}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeDocument('aadhar_card')} className="h-6 w-6 p-0 text-red-500">
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => aadharInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Choose Aadhar Card
                    </Button>
                  )}
                </div>

                {/* PAN Card Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-600" />
                    PAN Card
                  </Label>
                  <input
                    ref={panInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentSelect('pan_card', e.target.files[0])}
                    className="hidden"
                  />
                  {documents.pan_card ? (
                    <div className="flex items-center gap-2 p-2 bg-orange-100 rounded-lg border border-orange-200">
                      <File className="w-4 h-4 text-orange-600" />
                      <span className="text-sm flex-1 truncate">{documents.pan_card.name}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeDocument('pan_card')} className="h-6 w-6 p-0 text-red-500">
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => panInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Choose PAN Card
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
                    <div className="flex items-center gap-2 p-2 bg-green-100 rounded-lg border border-green-200">
                      <File className="w-4 h-4 text-green-600" />
                      <span className="text-sm flex-1 truncate">{documents.qualification_certificate.name}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeDocument('qualification_certificate')} className="h-6 w-6 p-0 text-red-500">
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => qualificationInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Choose Certificate
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
                    <div className="flex items-center gap-2 p-2 bg-purple-100 rounded-lg border border-purple-200">
                      <File className="w-4 h-4 text-purple-600" />
                      <span className="text-sm flex-1 truncate">{documents.guardian_consent_letter.name}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeDocument('guardian_consent_letter')} className="h-6 w-6 p-0 text-red-500">
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => consentInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Choose Consent Letter
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} data-testid="submit-application-btn">
            {loading ? (editApplication ? 'Updating...' : 'Submitting...') : (editApplication ? 'Update Application' : 'Submit Application')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
