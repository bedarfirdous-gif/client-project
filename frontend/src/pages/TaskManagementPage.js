import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  ClipboardList, Plus, Search, Edit, Trash2, 
  Calendar, Clock, User, Building2, Star, FileText,
  RefreshCw, History, BarChart3, X, Check, Download
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DEPARTMENTS = ['Sales', 'IT', 'Accounts', 'HR', 'Operations', 'Marketing', 'Logistics', 'Admin'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const TASK_TYPES = ['Hourly', 'Daily', 'Weekly', 'Monthly'];
const STATUSES = ['Pending', 'In Progress', 'Completed', 'Delayed'];

// Star Rating Component
const StarRating = ({ rating, onRatingChange, readonly = false, size = 'md' }) => {
  const [hoverRating, setHoverRating] = useState(0);
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
          onMouseEnter={() => !readonly && setHoverRating(star)}
          onMouseLeave={() => !readonly && setHoverRating(0)}
          onClick={() => !readonly && onRatingChange && onRatingChange(star === rating ? 0 : star)}
        >
          <Star
            className={`${sizeClass} ${
              (hoverRating || rating) >= star
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

// Multi-Select Employees Component
const MultiSelectEmployees = ({ employees, selectedEmployees, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  const toggleEmployee = useCallback((emp, e) => {
    // Prevent event bubbling
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const exists = selectedEmployees.find(se => se.id === emp.id);
    if (exists) {
      onChange(selectedEmployees.filter(se => se.id !== emp.id));
    } else {
      onChange([...selectedEmployees, { id: emp.id, name: emp.name }]);
    }
  }, [selectedEmployees, onChange]);
  
  const removeEmployee = useCallback((empId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onChange(selectedEmployees.filter(se => se.id !== empId));
  }, [selectedEmployees, onChange]);
  
  return (
    <div className="relative" ref={containerRef}>
      <div 
        className="min-h-[40px] p-2 border rounded-md bg-white cursor-pointer flex flex-wrap gap-1 items-center"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="multi-select-employees"
      >
        {selectedEmployees.length === 0 ? (
          <span className="text-gray-400 text-sm">Select employees...</span>
        ) : (
          selectedEmployees.map(emp => (
            <Badge key={emp.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
              <User className="w-3 h-3" />
              {emp.name}
              <button
                type="button"
                onClick={(e) => removeEmployee(emp.id, e)}
                className="ml-1 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto" data-testid="employee-dropdown">
          {employees.map(emp => {
            const isSelected = selectedEmployees.some(se => se.id === emp.id);
            return (
              <div
                key={emp.id}
                className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                onClick={(e) => toggleEmployee(emp, e)}
                data-testid={`employee-option-${emp.id}`}
              >
                <div className={`w-4 h-4 border rounded-sm flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="flex-1">{emp.name}</span>
                <span className="text-xs text-gray-500">{emp.designation || 'N/A'}</span>
              </div>
            );
          })}
          {employees.length === 0 && (
            <div className="px-3 py-2 text-gray-500 text-sm">No employees found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default function TaskManagementPage() {
  const { api } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskHistory, setTaskHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    department: 'all',
    status: 'all',
    priority: 'all',
    task_type: 'all'
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    department: '',
    assigned_employees: [],
    priority: 'Medium',
    task_type: 'Daily',
    start_date: '',
    due_date: '',
    estimated_hours: 0,
    status: 'Pending',
    completion_percentage: 0,
    rating: 0,
    remarks: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksData, employeesData, statsData] = await Promise.all([
        api('/api/tasks'),
        api('/api/employees'),
        api('/api/tasks/statistics')
      ]);
      setTasks(tasksData);
      setEmployees(employeesData);
      setStatistics(statsData);
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
      title: '',
      description: '',
      department: '',
      assigned_employees: [],
      priority: 'Medium',
      task_type: 'Daily',
      start_date: '',
      due_date: '',
      estimated_hours: 0,
      status: 'Pending',
      completion_percentage: 0,
      rating: 0,
      remarks: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.title) {
      toast.error('Task title is required');
      return;
    }
    
    try {
      const payload = {
        ...form,
        // Set legacy fields from first employee for backwards compatibility
        assigned_to: form.assigned_employees[0]?.id || '',
        assigned_to_name: form.assigned_employees[0]?.name || ''
      };
      
      if (editTask) {
        await api(`/api/tasks/${editTask.task_id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('Task updated successfully');
      } else {
        await api('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('Task created successfully');
      }
      setShowModal(false);
      setEditTask(null);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save task');
    }
  };

  const handleEdit = (task) => {
    setEditTask(task);
    
    // Convert legacy single employee to array format
    let assignedEmployees = task.assigned_employees || [];
    if (assignedEmployees.length === 0 && task.assigned_to) {
      assignedEmployees = [{ id: task.assigned_to, name: task.assigned_to_name || '' }];
    }
    
    setForm({
      title: task.title || '',
      description: task.description || '',
      department: task.department || '',
      assigned_employees: assignedEmployees,
      priority: task.priority || 'Medium',
      task_type: task.task_type || 'Daily',
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      estimated_hours: task.estimated_hours || 0,
      status: task.status || 'Pending',
      completion_percentage: task.completion_percentage || 0,
      rating: task.rating || 0,
      remarks: task.remarks || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
      toast.success('Task deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  const handleViewHistory = async (task) => {
    setSelectedTask(task);
    try {
      const history = await api(`/api/tasks/${task.task_id}/history`);
      setTaskHistory(history);
      setShowHistoryModal(true);
    } catch (err) {
      toast.error('Failed to load task history');
    }
  };

  const handleDownloadPdf = async (taskId) => {
    setDownloadingPdf(taskId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tasks/${taskId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Task_${taskId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('PDF downloaded successfully');
    } catch (err) {
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleRatingUpdate = async (task, newRating) => {
    try {
      await api(`/api/tasks/${task.task_id}`, {
        method: 'PUT',
        body: JSON.stringify({ rating: newRating })
      });
      toast.success('Rating updated');
      fetchData();
    } catch (err) {
      toast.error('Failed to update rating');
    }
  };

  const getPriorityBadge = (priority) => {
    const config = {
      'Low': 'bg-gray-100 text-gray-700',
      'Medium': 'bg-blue-100 text-blue-700',
      'High': 'bg-orange-100 text-orange-700',
      'Urgent': 'bg-red-100 text-red-700'
    };
    return <Badge className={config[priority] || config['Medium']}>{priority}</Badge>;
  };

  const getStatusBadge = (status) => {
    const config = {
      'Pending': 'bg-yellow-100 text-yellow-700',
      'In Progress': 'bg-blue-100 text-blue-700',
      'Completed': 'bg-green-100 text-green-700',
      'Delayed': 'bg-red-100 text-red-700'
    };
    return <Badge className={config[status] || config['Pending']}>{status}</Badge>;
  };

  // Get assigned employee names for display
  const getAssignedNames = (task) => {
    if (task.assigned_employees && task.assigned_employees.length > 0) {
      return task.assigned_employees.map(e => e.name).join(', ');
    }
    return task.assigned_to_name || '-';
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchTerm || 
      task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.task_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDept = filters.department === 'all' || task.department === filters.department;
    const matchesStatus = filters.status === 'all' || task.status === filters.status;
    const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;
    const matchesType = filters.task_type === 'all' || task.task_type === filters.task_type;
    
    return matchesSearch && matchesDept && matchesStatus && matchesPriority && matchesType;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-testid="task-management-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            Task Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Create, assign, and track tasks across departments</p>
        </div>
        
        <Button onClick={() => { resetForm(); setEditTask(null); setShowModal(true); }} data-testid="new-task-btn">
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{statistics.total || 0}</p>
            <p className="text-xs text-blue-600">Total Tasks</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-700">{statistics.pending || 0}</p>
            <p className="text-xs text-yellow-600">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-cyan-700">{statistics.in_progress || 0}</p>
            <p className="text-xs text-cyan-600">In Progress</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{statistics.completed || 0}</p>
            <p className="text-xs text-green-600">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{statistics.delayed || 0}</p>
            <p className="text-xs text-red-600">Delayed</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-700">{statistics.high_priority || 0}</p>
            <p className="text-xs text-orange-600">High Priority</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-700">{statistics.urgent || 0}</p>
            <p className="text-xs text-purple-600">Urgent</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by Task ID, title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="task-search-input"
                />
              </div>
            </div>
            
            <Select value={filters.department} onValueChange={(v) => setFilters(prev => ({ ...prev, department: v }))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filters.priority} onValueChange={(v) => setFilters(prev => ({ ...prev, priority: v }))}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {PRIORITIES.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filters.task_type} onValueChange={(v) => setFilters(prev => ({ ...prev, task_type: v }))}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TASK_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      {loading ? (
        <div className="text-center py-12">Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No tasks found</p>
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Task ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Assigned To</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Due Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Progress</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Rating</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTasks.map(task => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{task.task_id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">{task.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-gray-400" />
                        {task.department || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 max-w-[150px]">
                        <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="truncate" title={getAssignedNames(task)}>
                          {getAssignedNames(task)}
                        </span>
                        {task.assigned_employees && task.assigned_employees.length > 1 && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            +{task.assigned_employees.length - 1}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{getPriorityBadge(task.priority)}</td>
                    <td className="px-4 py-3 text-gray-600">{task.task_type}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {formatDate(task.due_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(task.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={task.completion_percentage || 0} className="w-16 h-2" />
                        <span className="text-xs text-gray-500">{task.completion_percentage || 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StarRating 
                        rating={task.rating || 0} 
                        onRatingChange={(r) => handleRatingUpdate(task, r)}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDownloadPdf(task.task_id)} 
                          title="Download PDF"
                          disabled={downloadingPdf === task.task_id}
                        >
                          {downloadingPdf === task.task_id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleViewHistory(task)} title="View History">
                          <History className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(task)} title="Edit">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(task.task_id)} title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Task Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              {editTask ? 'Edit Task' : 'Create New Task'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Task Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title"
                  required
                  data-testid="task-title-input"
                />
              </div>
              
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed task description"
                  rows={3}
                />
              </div>
              
              <div>
                <Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => setForm(prev => ({ ...prev, department: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Assign Employees (Multiple)</Label>
                <MultiSelectEmployees 
                  employees={employees}
                  selectedEmployees={form.assigned_employees}
                  onChange={(emps) => setForm(prev => ({ ...prev, assigned_employees: emps }))}
                />
              </div>
              
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Task Type</Label>
                <Select value={form.task_type} onValueChange={(v) => setForm(prev => ({ ...prev, task_type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              
              <div>
                <Label>Estimated Hours</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.estimated_hours}
                  onChange={(e) => setForm(prev => ({ ...prev, estimated_hours: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              
              <div>
                <Label>Rating</Label>
                <div className="py-2">
                  <StarRating 
                    rating={form.rating} 
                    onRatingChange={(r) => setForm(prev => ({ ...prev, rating: r }))}
                  />
                </div>
              </div>
              
              {editTask && (
                <>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm(prev => ({ ...prev, status: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Completion %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={form.completion_percentage}
                      onChange={(e) => setForm(prev => ({ ...prev, completion_percentage: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </>
              )}
              
              <div className="col-span-2">
                <Label>Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Additional notes or comments"
                  rows={2}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="save-task-btn">
                {editTask ? 'Update Task' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Version History - {selectedTask?.task_id}
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {taskHistory.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No history available</p>
            ) : (
              <div className="space-y-4">
                {taskHistory.map((entry, index) => (
                  <Card key={entry.id} className={index === 0 ? 'border-blue-200 bg-blue-50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <Badge variant="outline" className="mr-2">v{entry.version}</Badge>
                          <span className="font-medium">{entry.action}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{entry.changes}</p>
                      {entry.snapshot && (
                        <div className="flex gap-2 flex-wrap text-xs">
                          <Badge variant="secondary">Status: {entry.snapshot.status}</Badge>
                          <Badge variant="secondary">Priority: {entry.snapshot.priority}</Badge>
                          <Badge variant="secondary">Progress: {entry.snapshot.completion_percentage}%</Badge>
                          {entry.snapshot.rating > 0 && (
                            <Badge variant="secondary">Rating: {entry.snapshot.rating}/5</Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
