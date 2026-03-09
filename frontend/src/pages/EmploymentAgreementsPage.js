import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  FileText, Plus, Search, Edit, Trash2, Download, Printer, Eye, 
  Users, Building2, Calendar, DollarSign, Clock, Shield, CheckCircle,
  AlertTriangle, FileSignature, RefreshCw, ChevronDown, Copy
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function EmploymentAgreementsPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [agreements, setAgreements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Use a stable non-null sentinel for "no selection" to prevent a null -> object transition
  // that can mount/unmount edit UI and visually flicker.
  // Note: We still tolerate existing resets that set null by treating both null and the sentinel as "not editing".
  const NO_EDIT_SELECTION = useRef({ __noEditSelection: true }).current;
  const [editAgreement, setEditAgreement] = useState(NO_EDIT_SELECTION);
  const isEditing = editAgreement !== NO_EDIT_SELECTION && editAgreement !== null;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('company');
  const printRef = useRef(null);

  const [form, setForm] = useState({
    document_type: 'employment_agreement',
    template: 'standard',
    employee_id: '',
    // Company Info
    company_name: '',
    company_address: '',
    signatory_name: '',
    signatory_designation: '',
    // Employee Info
    employee_name: '',
    employee_address: '',
    job_title: '',
    department: '',
    employment_type: 'full_time',
    start_date: '',
    working_hours: '9:30 AM to 6:30 PM, Monday to Saturday',
    working_days: 'Monday to Saturday',
    // Seasonal Working Hours
    enable_seasonal_timing: true,
    winter_start_time: '9:30 AM',
    winter_end_time: '6:30 PM',
    winter_months: 'November to February',
    summer_start_time: '9:00 AM',
    summer_end_time: '8:30 PM',
    summer_months: 'March to October',
    // Compensation
    compensation_model: 'fixed_daily',
    total_monthly_salary: 0,
    fixed_salary: 0,
    daily_allowance_total: 0,
    daily_allowance_per_day: 100,
    working_days_month: 26,
    casual_leave_days: 4,
    // Salary Payment
    salary_period: 'Monthly',
    payment_cycle_start: '10',
    payment_cycle_end: '15',
    statutory_deductions: true,
    other_benefits: 'PF, ESI',
    // Terms
    notice_period_days: 30,
    non_compete_months: 6,
    governing_law: 'India',
    // Penalty
    min_service_months: 3,
    min_penalty_amount: 50000,
    employee_penalty_amount: 50000,
    employer_penalty_amount: 50000,
    // Additional
    additional_terms: '',
    confidentiality_clause: true,
    intellectual_property_clause: true,
    non_solicitation_clause: true,
    status: 'draft',
    // Attached Documents
    documents: {
      aadhar_card: false,
      pan_card: false,
      qualification_certificate: false,
      guardian_consent_letter: false
    }
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [agreementsData, employeesData, templatesData] = await Promise.all([
        api('/api/employment-agreements'),
        api('/api/employees'),
        api('/api/agreement-templates')
      ]);
      setAgreements(agreementsData);
      setEmployees(employeesData);
      setTemplates(templatesData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setForm({
      document_type: 'employment_agreement',
      template: 'standard',
      employee_id: '',
      company_name: '',
      company_address: '',
      signatory_name: '',
      signatory_designation: '',
      employee_name: '',
      employee_address: '',
      job_title: '',
      department: '',
      employment_type: 'full_time',
      start_date: '',
      working_hours: '9:30 AM to 6:30 PM, Monday to Saturday',
      working_days: 'Monday to Saturday',
      enable_seasonal_timing: true,
      winter_start_time: '9:30 AM',
      winter_end_time: '6:30 PM',
      winter_months: 'November to February',
      summer_start_time: '9:00 AM',
      summer_end_time: '8:30 PM',
      summer_months: 'March to October',
      compensation_model: 'fixed_daily',
      total_monthly_salary: 0,
      fixed_salary: 0,
      daily_allowance_total: 0,
      daily_allowance_per_day: 100,
      working_days_month: 26,
      casual_leave_days: 4,
      salary_period: 'Monthly',
      payment_cycle_start: '10',
      payment_cycle_end: '15',
      statutory_deductions: true,
      other_benefits: 'PF, ESI',
      notice_period_days: 30,
      non_compete_months: 6,
      governing_law: 'India',
      min_service_months: 3,
      min_penalty_amount: 50000,
      employee_penalty_amount: 50000,
      employer_penalty_amount: 50000,
      additional_terms: '',
      confidentiality_clause: true,
      intellectual_property_clause: true,
      non_solicitation_clause: true,
      status: 'draft'
    });
  };

  const handleTemplateChange = (templateKey) => {
    const template = templates[templateKey];
    if (template) {
      setForm(prev => ({
        ...prev,
        template: templateKey,
        notice_period_days: template.default_terms.notice_period_days,
        non_compete_months: template.default_terms.non_compete_months,
        governing_law: template.default_terms.governing_law,
        min_service_months: template.default_terms.min_service_months,
        working_hours: template.default_terms.working_hours
      }));
    }
  };

  const handleEmployeeChange = async (employeeId) => {
    setForm(prev => ({ ...prev, employee_id: employeeId }));
    
    if (employeeId) {
      try {
        const autoData = await api(`/api/employment-agreements/auto-populate?employee_id=${employeeId}`);
        setForm(prev => ({
          ...prev,
          ...autoData
        }));
        toast.success('Employee data loaded');
      } catch (err) {
        console.error('Failed to auto-populate:', err);
      }
    }
  };

  const calculateCompensation = () => {
    const dailyAllowanceTotal = form.daily_allowance_per_day * form.working_days_month;
    const totalMonthly = form.fixed_salary + dailyAllowanceTotal;
    
    setForm(prev => ({
      ...prev,
      daily_allowance_total: dailyAllowanceTotal,
      total_monthly_salary: totalMonthly
    }));
  };

  useEffect(() => {
    calculateCompensation();
  }, [form.fixed_salary, form.daily_allowance_per_day, form.working_days_month]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.employee_id) {
      toast.error('Please select an employee');
      return;
    }
    
    try {
      if (editAgreement) {
        await api(`/api/employment-agreements/${editAgreement.id}`, {
          method: 'PUT',
          body: JSON.stringify(form)
        });
        toast.success('Agreement updated successfully');
      } else {
        await api('/api/employment-agreements', {
          method: 'POST',
          body: JSON.stringify(form)
        });
        toast.success('Agreement created successfully');
      }
      setShowModal(false);
      setEditAgreement(null);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save agreement');
    }
  };

  const handleEdit = (agreement) => {
    setEditAgreement(agreement);
    setForm({
      ...agreement,
      employee_id: agreement.employee_id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this agreement?')) return;
    
    try {
      await api(`/api/employment-agreements/${id}`, { method: 'DELETE' });
      toast.success('Agreement deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete agreement');
    }
  };

  const handlePreview = (agreement) => {
    setEditAgreement(agreement);
    setForm(agreement);
    setShowPreview(true);
  };

  const generatePDF = async () => {
    if (!printRef.current) return;
    
    toast.loading('Generating PDF with documents...', { id: 'pdf-gen' });
    
    try {
      // Step 1: Generate agreement page from HTML preview
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      // Step 2: Fetch and embed employee documents if employee_id exists
      if (form.employee_id) {
        try {
          const employeeFiles = await api(`/api/employees/${form.employee_id}/files`);
          
          if (employeeFiles && employeeFiles.length > 0) {
            // Add a separator page for documents
            pdf.addPage();
            pdf.setFontSize(18);
            pdf.setFont(undefined, 'bold');
            pdf.text('ANNEXURE: ATTACHED DOCUMENTS', pdfWidth / 2, 20, { align: 'center' });
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'normal');
            pdf.text(`Total Documents: ${employeeFiles.length}`, pdfWidth / 2, 30, { align: 'center' });
            
            let yOffset = 45;
            
            for (const file of employeeFiles) {
              const docType = file.document_type || file.original_filename || 'Document';
              const isImage = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.content_type);
              
              // Add document header
              pdf.setFontSize(11);
              pdf.setFont(undefined, 'bold');
              pdf.text(`• ${docType.replace(/_/g, ' ').toUpperCase()}`, 15, yOffset);
              pdf.setFont(undefined, 'normal');
              pdf.setFontSize(9);
              pdf.text(`(${file.original_filename || 'file'})`, 15, yOffset + 5);
              yOffset += 12;
              
              // For images, try to embed them
              if (isImage) {
                try {
                  const imgResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}${file.file_url}`);
                  if (imgResponse.ok) {
                    const blob = await imgResponse.blob();
                    const reader = new FileReader();
                    const docImgData = await new Promise((resolve, reject) => {
                      reader.onload = () => resolve(reader.result);
                      reader.onerror = reject;
                      reader.readAsDataURL(blob);
                    });
                    
                    // Calculate image dimensions to fit on page
                    const img = new Image();
                    await new Promise((resolve) => {
                      img.onload = resolve;
                      img.src = docImgData;
                    });
                    
                    const maxWidth = pdfWidth - 30;
                    const maxHeight = pdfHeight - yOffset - 20;
                    let docImgWidth = img.width * 0.264583; // px to mm
                    let docImgHeight = img.height * 0.264583;
                    
                    if (docImgWidth > maxWidth) {
                      const scale = maxWidth / docImgWidth;
                      docImgWidth = maxWidth;
                      docImgHeight *= scale;
                    }
                    if (docImgHeight > maxHeight) {
                      const scale = maxHeight / docImgHeight;
                      docImgHeight = maxHeight;
                      docImgWidth *= scale;
                    }
                    
                    // Check if we need a new page
                    if (yOffset + docImgHeight > pdfHeight - 20) {
                      pdf.addPage();
                      yOffset = 20;
                    }
                    
                    pdf.addImage(docImgData, 'JPEG', 15, yOffset, docImgWidth, docImgHeight);
                    yOffset += docImgHeight + 15;
                  }
                } catch (imgErr) {
                  pdf.setFontSize(9);
                  pdf.setTextColor(150, 150, 150);
                  pdf.text('(Image could not be embedded - see original file)', 20, yOffset);
                  pdf.setTextColor(0, 0, 0);
                  yOffset += 10;
                }
              } else {
                // For PDFs, just note that they're attached
                pdf.setFontSize(9);
                pdf.setTextColor(100, 100, 100);
                pdf.text('(PDF document - refer to separate attachment)', 20, yOffset);
                pdf.setTextColor(0, 0, 0);
                yOffset += 10;
              }
              
              // Check if we need a new page for next document
              if (yOffset > pdfHeight - 40) {
                pdf.addPage();
                yOffset = 20;
              }
            }
          }
        } catch (docErr) {
          console.warn('Could not fetch employee documents:', docErr);
          // Continue without documents - don't fail the entire PDF
        }
      }
      
      pdf.save(`employment-agreement-${form.employee_name || 'document'}.pdf`);
      
      toast.success('PDF generated with documents', { id: 'pdf-gen' });
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF', { id: 'pdf-gen' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
      pending_signature: { label: 'Pending Signature', className: 'bg-yellow-100 text-yellow-700' },
      signed: { label: 'Signed', className: 'bg-green-100 text-green-700' },
      expired: { label: 'Expired', className: 'bg-red-100 text-red-700' },
      terminated: { label: 'Terminated', className: 'bg-red-100 text-red-700' }
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const filteredAgreements = agreements.filter(a => {
    const matchesSearch = a.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         a.job_title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Agreement Preview/Print Template
  const AgreementTemplate = () => (
    <div ref={printRef} className="bg-white p-8 max-w-4xl mx-auto text-sm print:p-4" style={{ fontFamily: 'Times New Roman, serif' }}>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold uppercase tracking-wide">Employment Agreement</h1>
        <p className="text-gray-600 mt-2">Confidential Document</p>
      </div>

      <div className="mb-6">
        <p className="mb-4">
          This Employment Agreement (the &quot;Agreement&quot;) is entered into as of <strong>{formatDate(form.start_date)}</strong>
        </p>
        <p className="mb-2"><strong>BETWEEN:</strong></p>
        <p className="ml-4 mb-4">
          <strong>{form.company_name}</strong>, a company with its registered office at {form.company_address} 
          (hereinafter referred to as the &quot;Employer&quot;), represented by {form.signatory_name}, {form.signatory_designation}
        </p>
        <p className="mb-2"><strong>AND:</strong></p>
        <p className="ml-4">
          <strong>{form.employee_name}</strong>, residing at {form.employee_address}
          (hereinafter referred to as the &quot;Employee&quot;)
        </p>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b pb-1">1. POSITION AND DUTIES</h2>
        <p className="mb-2">
          The Employer hereby employs the Employee as <strong>{form.job_title}</strong> in the <strong>{form.department}</strong> department.
        </p>
        <p className="mb-2">
          <strong>Employment Type:</strong> {form.employment_type === 'full_time' ? 'Full-Time' : form.employment_type === 'part_time' ? 'Part-Time' : 'Contract'}
        </p>
        <p className="mb-2">
          <strong>Working Days:</strong> {form.working_days}
        </p>
        
        {/* Working Hours - Seasonal or Fixed */}
        {form.enable_seasonal_timing ? (
          <div className="bg-gray-50 rounded p-3 mt-2">
            <p className="font-medium mb-2">Working Hours (Seasonal):</p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-1 font-medium">❄️ Winter ({form.winter_months}):</td>
                  <td className="py-1">{form.winter_start_time} to {form.winter_end_time}</td>
                </tr>
                <tr>
                  <td className="py-1 font-medium">☀️ Summer ({form.summer_months}):</td>
                  <td className="py-1">{form.summer_start_time} to {form.summer_end_time}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            <strong>Working Hours:</strong> {form.working_hours}
          </p>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b pb-1">2. COMPENSATION</h2>
        <table className="w-full border-collapse mb-4">
          <tbody>
            <tr className="border-b">
              <td className="py-2 font-medium">Fixed Monthly Salary</td>
              <td className="py-2 text-right">{formatCurrency(form.fixed_salary)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 font-medium">Daily Allowance ({form.working_days_month} days × {formatCurrency(form.daily_allowance_per_day)})</td>
              <td className="py-2 text-right">{formatCurrency(form.daily_allowance_total)}</td>
            </tr>
            <tr className="bg-gray-50 font-bold">
              <td className="py-2">Total Monthly Compensation</td>
              <td className="py-2 text-right">{formatCurrency(form.total_monthly_salary)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm text-gray-600 mb-3">
          Working Days per Month: {form.working_days_month} | Casual Leave Days per Year: {form.casual_leave_days}
        </p>
        
        {/* Salary Payment Section */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
          <h4 className="font-semibold text-blue-800 mb-2">Salary Payment</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li><strong>Salary Period:</strong> {form.salary_period || 'Monthly'}</li>
            <li><strong>Payment Cycle:</strong> Salary shall be released between {form.payment_cycle_start || '10'}th and {form.payment_cycle_end || '15'}th of the following month</li>
            <li>All payments are subject to statutory deductions as applicable.</li>
          </ul>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b pb-1">3. TERMS OF EMPLOYMENT</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li><strong>Notice Period:</strong> {form.notice_period_days} days</li>
          <li><strong>Non-Compete Period:</strong> {form.non_compete_months} months after termination</li>
          <li><strong>Governing Law:</strong> Laws of {form.governing_law}</li>
        </ul>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b pb-1">4. EARLY EXIT COMPENSATION</h2>
        <p className="mb-2">
          <strong>Minimum Service Period:</strong> {form.min_service_months} months
        </p>
        <p className="mb-2">
          If the Employee terminates employment before completing the minimum service period, the Employee shall pay the Employer 
          a penalty amount of <strong>{formatCurrency(form.employee_penalty_amount)}</strong>.
        </p>
        <p>
          If the Employer terminates employment without cause before the minimum service period, the Employer shall pay the Employee 
          a compensation of <strong>{formatCurrency(form.employer_penalty_amount)}</strong>.
        </p>
      </div>

      {form.confidentiality_clause && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3 border-b pb-1">5. CONFIDENTIALITY</h2>
          <p>
            The Employee agrees to maintain strict confidentiality regarding all proprietary information, trade secrets, 
            and business information of the Employer during and after employment.
          </p>
        </div>
      )}

      {form.additional_terms && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3 border-b pb-1">6. ADDITIONAL TERMS</h2>
          <p className="whitespace-pre-wrap">{form.additional_terms}</p>
        </div>
      )}

      {/* Employee Restriction & Protection Clause - Indian Law Compliant */}
      <div className="mb-6 page-break-inside-avoid">
        <h2 className="text-lg font-bold mb-3 border-b pb-1 text-red-800">7. EMPLOYEE RESTRICTION & PROTECTION CLAUSE</h2>
        <p className="text-xs text-gray-500 mb-4">(Indian Law Compliant Version)</p>
        
        {/* 7.1 Non-Compete During Employment */}
        <div className="mb-4">
          <h3 className="font-bold mb-2">7.1 Non-Compete During Employment</h3>
          <p className="mb-2">
            The Employee shall not, during the course of employment, directly or indirectly:
          </p>
          <ul className="list-disc ml-6 space-y-1 text-sm">
            <li>Engage in any competing business</li>
            <li>Work for any competitor</li>
            <li>Provide consultancy or advisory services to any competing entity</li>
            <li>Have financial interest in any competing business (except minor listed shareholding)</li>
          </ul>
          <p className="mt-2 text-sm">
            within a radius of <strong>3 kilometers</strong> from the Company's business location or within any area where the Company operates.
          </p>
          <p className="mt-2 text-sm italic">
            This applies whether full-time, part-time, freelance, advisory, or indirect involvement.
          </p>
        </div>

        {/* 7.2 Post-Employment Non-Solicitation */}
        <div className="mb-4">
          <h3 className="font-bold mb-2">7.2 Post-Employment Non-Solicitation (12 Months)</h3>
          <p className="mb-2 text-sm">
            For a period of <strong>12 months after termination</strong>, the Employee shall not:
          </p>
          <ul className="list-disc ml-6 space-y-1 text-sm">
            <li>Solicit or approach the Company's clients</li>
            <li>Induce any existing employee to leave</li>
            <li>Divert business opportunities of the Company</li>
            <li>Use confidential information for personal or competitor benefit</li>
          </ul>
          <p className="mt-2 text-xs text-gray-600 italic">
            Note: This is more enforceable than non-compete clauses under Indian law.
          </p>
        </div>

        {/* 7.3 Confidentiality (Permanent) */}
        <div className="mb-4">
          <h3 className="font-bold mb-2">7.3 Confidentiality (Permanent Obligation)</h3>
          <p className="mb-2 text-sm">
            The Employee agrees that all business data including:
          </p>
          <ul className="list-disc ml-6 space-y-1 text-sm">
            <li>Client database</li>
            <li>Pricing strategy</li>
            <li>Business model</li>
            <li>Financial data</li>
            <li>Source code / software logic</li>
            <li>Vendor details</li>
            <li>Trade secrets</li>
          </ul>
          <p className="mt-2 text-sm">
            shall remain <strong>strictly confidential</strong> during and after employment.
          </p>
          <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
            <p className="text-sm text-red-800 font-medium">Breach of confidentiality shall result in:</p>
            <ul className="list-disc ml-6 text-sm text-red-700">
              <li>Immediate legal action</li>
              <li>Claim for damages</li>
              <li>Injunction order from court</li>
            </ul>
          </div>
        </div>

        {/* 7.4 Intellectual Property */}
        <div className="mb-4">
          <h3 className="font-bold mb-2">7.4 Intellectual Property</h3>
          <p className="text-sm">
            All work, software, ideas, documents, code, strategies created during employment shall remain <strong>sole property of the Company</strong>.
          </p>
        </div>

        {/* 7.5 Legal Remedies */}
        <div className="mb-4">
          <h3 className="font-bold mb-2">7.5 Legal Remedies</h3>
          <p className="mb-2 text-sm">
            The Company shall have the right to seek:
          </p>
          <ul className="list-disc ml-6 space-y-1 text-sm">
            <li>Injunction relief</li>
            <li>Damages</li>
            <li>Legal costs</li>
            <li>Criminal complaint (if applicable)</li>
          </ul>
          <p className="mt-2 text-sm">
            as per <strong>Indian Contract Act, IT Act</strong>, and applicable laws.
          </p>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-8">
        <div>
          <p className="font-bold mb-4">FOR THE EMPLOYER:</p>
          <div className="border-t border-black pt-2 mt-16">
            <p><strong>{form.signatory_name}</strong></p>
            <p>{form.signatory_designation}</p>
            <p>{form.company_name}</p>
            <p className="text-sm text-gray-600 mt-2">Date: _________________</p>
          </div>
        </div>
        <div>
          <p className="font-bold mb-4">FOR THE EMPLOYEE:</p>
          <div className="border-t border-black pt-2 mt-16">
            <p><strong>{form.employee_name}</strong></p>
            <p>{form.job_title}</p>
            <p className="text-sm text-gray-600 mt-2">Date: _________________</p>
          </div>
        </div>
      </div>

      {/* Attached Documents Section */}
      <div className="mt-10 border-t-2 border-gray-400 pt-6">
        <h3 className="font-bold text-lg mb-4">ANNEXURE A: ATTACHED DOCUMENTS</h3>
        <p className="text-sm mb-4">The following documents have been submitted by the Employee as part of this Agreement:</p>
        <table className="w-full border-collapse border border-gray-400 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-left">S.No</th>
              <th className="border border-gray-400 px-3 py-2 text-left">Document Type</th>
              <th className="border border-gray-400 px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 px-3 py-2">1</td>
              <td className="border border-gray-400 px-3 py-2">Aadhar Card</td>
              <td className="border border-gray-400 px-3 py-2">{form.documents?.aadhar_card ? '✓ Submitted' : '☐ Pending'}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-3 py-2">2</td>
              <td className="border border-gray-400 px-3 py-2">PAN Card</td>
              <td className="border border-gray-400 px-3 py-2">{form.documents?.pan_card ? '✓ Submitted' : '☐ Pending'}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-3 py-2">3</td>
              <td className="border border-gray-400 px-3 py-2">Qualification Certificate</td>
              <td className="border border-gray-400 px-3 py-2">{form.documents?.qualification_certificate ? '✓ Submitted' : '☐ Pending'}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-3 py-2">4</td>
              <td className="border border-gray-400 px-3 py-2">Guardian/Father Consent Letter</td>
              <td className="border border-gray-400 px-3 py-2">{form.documents?.guardian_consent_letter ? '✓ Submitted' : '☐ Pending'}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-3 italic">
          Note: All documents will be verified by the HR department. Original documents must be presented for verification upon request.
        </p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-testid="employment-agreements-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="w-7 h-7 text-primary" />
            Employment Agreements
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage employee contracts and agreements</p>
        </div>
        
        <Button onClick={() => { resetForm(); setEditAgreement(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Agreement
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by employee name or job title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_signature">Pending Signature</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agreements List */}
      {loading ? (
        <div className="text-center py-12">Loading agreements...</div>
      ) : filteredAgreements.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No agreements found</p>
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Agreement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAgreements.map(agreement => (
            <Card key={agreement.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-lg">{agreement.employee_name}</h3>
                      {getStatusBadge(agreement.status)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="text-gray-400">Position:</span>
                        <p className="font-medium text-gray-800">{agreement.job_title}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Department:</span>
                        <p className="font-medium text-gray-800">{agreement.department}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Start Date:</span>
                        <p className="font-medium text-gray-800">{formatDate(agreement.start_date)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Salary:</span>
                        <p className="font-medium text-gray-800">{formatCurrency(agreement.total_monthly_salary)}/mo</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePreview(agreement)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(agreement)} disabled={agreement.status === 'signed'}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(agreement.id)} disabled={agreement.status === 'signed'}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5" />
              {editAgreement ? 'Edit Agreement' : 'Create Employment Agreement'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="company">Company</TabsTrigger>
                <TabsTrigger value="employee">Employee</TabsTrigger>
                <TabsTrigger value="compensation">Compensation</TabsTrigger>
                <TabsTrigger value="terms">Terms</TabsTrigger>
                <TabsTrigger value="penalty">Penalty</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>

              {/* Company Tab */}
              <TabsContent value="company" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Template</Label>
                    <Select value={form.template} onValueChange={handleTemplateChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(templates).map(([key, template]) => (
                          <SelectItem key={key} value={key}>{template.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">{templates[form.template]?.description}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm(prev => ({ ...prev, status: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending_signature">Pending Signature</SelectItem>
                        <SelectItem value="signed">Signed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Company Name *</Label>
                    <Input
                      value={form.company_name}
                      onChange={(e) => setForm(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder="Enter company name"
                      required
                    />
                  </div>
                  <div>
                    <Label>Company Address</Label>
                    <Input
                      value={form.company_address}
                      onChange={(e) => setForm(prev => ({ ...prev, company_address: e.target.value }))}
                      placeholder="Enter company address"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Signatory Name *</Label>
                    <Input
                      value={form.signatory_name}
                      onChange={(e) => setForm(prev => ({ ...prev, signatory_name: e.target.value }))}
                      placeholder="Name of authorized signatory"
                      required
                    />
                  </div>
                  <div>
                    <Label>Signatory Designation</Label>
                    <Input
                      value={form.signatory_designation}
                      onChange={(e) => setForm(prev => ({ ...prev, signatory_designation: e.target.value }))}
                      placeholder="e.g., Director, HR Manager"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Employee Tab */}
              <TabsContent value="employee" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Select Employee *</Label>
                    <Select value={form.employee_id} onValueChange={handleEmployeeChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.name} - {emp.designation || 'N/A'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">Select to auto-populate employee details</p>
                  </div>
                  <div>
                    <Label>Employee Name</Label>
                    <Input
                      value={form.employee_name}
                      onChange={(e) => setForm(prev => ({ ...prev, employee_name: e.target.value }))}
                      placeholder="Employee full name"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Employee Address</Label>
                  <Textarea
                    value={form.employee_address}
                    onChange={(e) => setForm(prev => ({ ...prev, employee_address: e.target.value }))}
                    placeholder="Employee residential address"
                    rows={2}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Job Title *</Label>
                    <Input
                      value={form.job_title}
                      onChange={(e) => setForm(prev => ({ ...prev, job_title: e.target.value }))}
                      placeholder="e.g., Software Engineer"
                      required
                    />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Input
                      value={form.department}
                      onChange={(e) => setForm(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="e.g., Engineering"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Employment Type</Label>
                    <Select value={form.employment_type} onValueChange={(v) => setForm(prev => ({ ...prev, employment_type: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full-Time</SelectItem>
                        <SelectItem value="part_time">Part-Time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Start Date *</Label>
                    <Input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label>Working Days</Label>
                    <Input
                      value={form.working_days}
                      onChange={(e) => setForm(prev => ({ ...prev, working_days: e.target.value }))}
                      placeholder="e.g., Monday to Saturday"
                    />
                  </div>
                </div>

                {/* Seasonal Working Hours Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-blue-800 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Seasonal Working Hours
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.enable_seasonal_timing}
                        onChange={(e) => setForm(prev => ({ ...prev, enable_seasonal_timing: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-blue-700">Enable seasonal timing</span>
                    </label>
                  </div>

                  {form.enable_seasonal_timing ? (
                    <div className="space-y-4">
                      {/* Winter Timing */}
                      <div className="bg-white rounded-lg p-3 border border-blue-100">
                        <h5 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
                          ❄️ Winter Timing
                        </h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Start Time</Label>
                            <Input
                              value={form.winter_start_time}
                              onChange={(e) => setForm(prev => ({ ...prev, winter_start_time: e.target.value }))}
                              placeholder="9:30 AM"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">End Time</Label>
                            <Input
                              value={form.winter_end_time}
                              onChange={(e) => setForm(prev => ({ ...prev, winter_end_time: e.target.value }))}
                              placeholder="6:30 PM"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Months</Label>
                            <Input
                              value={form.winter_months}
                              onChange={(e) => setForm(prev => ({ ...prev, winter_months: e.target.value }))}
                              placeholder="Nov to Feb"
                              className="h-9"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Summer Timing */}
                      <div className="bg-white rounded-lg p-3 border border-orange-100">
                        <h5 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
                          ☀️ Summer Timing
                        </h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Start Time</Label>
                            <Input
                              value={form.summer_start_time}
                              onChange={(e) => setForm(prev => ({ ...prev, summer_start_time: e.target.value }))}
                              placeholder="9:00 AM"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">End Time</Label>
                            <Input
                              value={form.summer_end_time}
                              onChange={(e) => setForm(prev => ({ ...prev, summer_end_time: e.target.value }))}
                              placeholder="8:30 PM"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Months</Label>
                            <Input
                              value={form.summer_months}
                              onChange={(e) => setForm(prev => ({ ...prev, summer_months: e.target.value }))}
                              placeholder="Mar to Oct"
                              className="h-9"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label>Fixed Working Hours</Label>
                      <Input
                        value={form.working_hours}
                        onChange={(e) => setForm(prev => ({ ...prev, working_hours: e.target.value }))}
                        placeholder="e.g., 9:00 AM to 6:00 PM"
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Compensation Tab */}
              <TabsContent value="compensation" className="space-y-4 mt-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-amber-800 mb-2">Fixed + Daily Allowance Model</h4>
                  <p className="text-sm text-amber-700">Total = Fixed Salary + (Daily Allowance × Working Days)</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Fixed Salary ({currencySymbol}/month)</Label>
                    <Input
                      type="number"
                      value={form.fixed_salary}
                      onChange={(e) => setForm(prev => ({ ...prev, fixed_salary: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Daily Allowance ({currencySymbol}/day)</Label>
                    <Input
                      type="number"
                      value={form.daily_allowance_per_day}
                      onChange={(e) => setForm(prev => ({ ...prev, daily_allowance_per_day: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Working Days/Month</Label>
                    <Input
                      type="number"
                      value={form.working_days_month}
                      onChange={(e) => setForm(prev => ({ ...prev, working_days_month: parseInt(e.target.value) || 26 }))}
                    />
                  </div>
                  <div>
                    <Label>Casual Leave Days/Year</Label>
                    <Input
                      type="number"
                      value={form.casual_leave_days}
                      onChange={(e) => setForm(prev => ({ ...prev, casual_leave_days: parseInt(e.target.value) || 12 }))}
                    />
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-green-600">Fixed Salary</p>
                      <p className="text-xl font-bold text-green-700">{formatCurrency(form.fixed_salary)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-600">Daily Allowance Total</p>
                      <p className="text-xl font-bold text-green-700">{formatCurrency(form.daily_allowance_total)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-600">Total Monthly</p>
                      <p className="text-2xl font-bold text-green-800">{formatCurrency(form.total_monthly_salary)}</p>
                    </div>
                  </div>
                </div>

                {/* Salary Payment Section */}
                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Salary Payment Terms
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        Salary shall be released between <strong>{form.payment_cycle_start}th and {form.payment_cycle_end}th</strong> of the following month. 
                        All payments are subject to statutory deductions as applicable.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Salary Period</Label>
                        <Select value={form.salary_period} onValueChange={(v) => setForm(prev => ({ ...prev, salary_period: v }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Weekly">Weekly</SelectItem>
                            <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Payment From (Day)</Label>
                        <Select value={form.payment_cycle_start} onValueChange={(v) => setForm(prev => ({ ...prev, payment_cycle_start: v }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[...Array(28)].map((_, i) => (
                              <SelectItem key={i+1} value={String(i+1)}>{i+1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Payment To (Day)</Label>
                        <Select value={form.payment_cycle_end} onValueChange={(v) => setForm(prev => ({ ...prev, payment_cycle_end: v }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[...Array(28)].map((_, i) => (
                              <SelectItem key={i+1} value={String(i+1)}>{i+1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      All payments subject to statutory deductions (PF, ESI, TDS) as applicable under Indian law.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Terms Tab */}
              <TabsContent value="terms" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Notice Period (days)</Label>
                    <Input
                      type="number"
                      value={form.notice_period_days}
                      onChange={(e) => setForm(prev => ({ ...prev, notice_period_days: parseInt(e.target.value) || 30 }))}
                    />
                  </div>
                  <div>
                    <Label>Non-Compete Period (months)</Label>
                    <Input
                      type="number"
                      value={form.non_compete_months}
                      onChange={(e) => setForm(prev => ({ ...prev, non_compete_months: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Governing Law</Label>
                    <Input
                      value={form.governing_law}
                      onChange={(e) => setForm(prev => ({ ...prev, governing_law: e.target.value }))}
                      placeholder="e.g., India"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Additional Terms &amp; Conditions</Label>
                  <Textarea
                    value={form.additional_terms}
                    onChange={(e) => setForm(prev => ({ ...prev, additional_terms: e.target.value }))}
                    placeholder="Enter any additional terms or clauses..."
                    rows={4}
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="confidentiality"
                    checked={form.confidentiality_clause}
                    onChange={(e) => setForm(prev => ({ ...prev, confidentiality_clause: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="confidentiality" className="cursor-pointer">Include Confidentiality Clause</Label>
                </div>
              </TabsContent>

              {/* Penalty Tab */}
              <TabsContent value="penalty" className="space-y-4 mt-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Early Exit Compensation
                  </h4>
                  <p className="text-sm text-red-700">Penalties apply if employment ends before minimum service period</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Minimum Service Period (months)</Label>
                    <Input
                      type="number"
                      value={form.min_service_months}
                      onChange={(e) => setForm(prev => ({ ...prev, min_service_months: parseInt(e.target.value) || 12 }))}
                    />
                  </div>
                  <div>
                    <Label>Minimum Penalty Amount ({currencySymbol})</Label>
                    <Input
                      type="number"
                      value={form.min_penalty_amount}
                      onChange={(e) => setForm(prev => ({ ...prev, min_penalty_amount: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Employee Penalty Amount ({currencySymbol})</Label>
                    <Input
                      type="number"
                      value={form.employee_penalty_amount}
                      onChange={(e) => setForm(prev => ({ ...prev, employee_penalty_amount: parseFloat(e.target.value) || 0 }))}
                      placeholder="If employee exits early"
                    />
                    <p className="text-xs text-gray-500 mt-1">Amount employee pays if they leave early</p>
                  </div>
                  <div>
                    <Label>Employer Penalty Amount ({currencySymbol})</Label>
                    <Input
                      type="number"
                      value={form.employer_penalty_amount}
                      onChange={(e) => setForm(prev => ({ ...prev, employer_penalty_amount: parseFloat(e.target.value) || 0 }))}
                      placeholder="If employer terminates early"
                    />
                    <p className="text-xs text-gray-500 mt-1">Amount employer pays if they terminate early</p>
                  </div>
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-4 mt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Attached Documents Checklist
                  </h4>
                  <p className="text-sm text-blue-700 mb-4">
                    Mark the documents that have been submitted by the employee. This will be included in the agreement PDF.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.documents?.aadhar_card || false}
                        onChange={(e) => setForm(prev => ({ 
                          ...prev, 
                          documents: { ...prev.documents, aadhar_card: e.target.checked }
                        }))}
                        className="w-5 h-5 text-blue-600"
                      />
                      <div>
                        <p className="font-medium">Aadhar Card</p>
                        <p className="text-xs text-gray-500">Government ID proof</p>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.documents?.pan_card || false}
                        onChange={(e) => setForm(prev => ({ 
                          ...prev, 
                          documents: { ...prev.documents, pan_card: e.target.checked }
                        }))}
                        className="w-5 h-5 text-orange-600"
                      />
                      <div>
                        <p className="font-medium">PAN Card</p>
                        <p className="text-xs text-gray-500">Tax identification</p>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.documents?.qualification_certificate || false}
                        onChange={(e) => setForm(prev => ({ 
                          ...prev, 
                          documents: { ...prev.documents, qualification_certificate: e.target.checked }
                        }))}
                        className="w-5 h-5 text-green-600"
                      />
                      <div>
                        <p className="font-medium">Qualification Certificate</p>
                        <p className="text-xs text-gray-500">Educational/professional certificates</p>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.documents?.guardian_consent_letter || false}
                        onChange={(e) => setForm(prev => ({ 
                          ...prev, 
                          documents: { ...prev.documents, guardian_consent_letter: e.target.checked }
                        }))}
                        className="w-5 h-5 text-purple-600"
                      />
                      <div>
                        <p className="font-medium">Guardian/Father Consent Letter</p>
                        <p className="text-xs text-gray-500">Signed consent from guardian</p>
                      </div>
                    </label>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editAgreement ? 'Update Agreement' : 'Create Agreement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Agreement Preview
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button size="sm" onClick={generatePDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="border rounded-lg mt-4 overflow-hidden">
            <AgreementTemplate />
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Styles */}
      <style>{`
        /* Smooth on-screen hide/show to avoid abrupt flicker; print still uses visibility isolation */
        .print-content {
          opacity: 1;
          transition: opacity 150ms ease-in-out; /* prevents abrupt changes when preview/modal toggles */
        }

        /* FIX: These containers toggle opacity between 0/1; ensure the base state defines the transition.
           Without this, React state changes (preview/modal open/close) can cause an abrupt paint that looks like flicker. */
        .fade-container {
          /* Helps avoid layout jump when content fades in/out */
          min-height: 100px;
        }

        /* Apply transition on the non-visible/default state so both directions (0->1 and 1->0) animate smoothly */
        .print-content,
        .print-container,
        .preview-container,
        .modal-container,
        .agreement-preview {
          transition: opacity 150ms ease-in-out;
          will-change: opacity; /* hint to reduce flicker during rapid toggles */
        }

        .print-content.hidden {
          opacity: 0;
          transition: opacity 150ms ease-in-out; /* keep transition defined in the hidden state too */
        }

        .print-preview {
          opacity: 1;
          transition: opacity 150ms ease-in-out; /* smooth show/hide when preview is toggled */
        }

        .print-preview.hidden {
          opacity: 0;
          transition: opacity 150ms ease-in-out; /* prevents abrupt changes when hiding */
        }
        
        @media print {
          /* In print mode we isolate content via visibility, but ensure no transitions run (can cause blink) */
          * {
            transition: none !important;
            animation: none !important;
          }
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            opacity: 1; /* explicit for print rendering */
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
