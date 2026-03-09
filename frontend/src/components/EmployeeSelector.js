import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Search, User, Building2 } from 'lucide-react';

/**
 * Centralized Employee Selector Component
 * Use this component across all modules to select employees from the master repository
 * 
 * Props:
 * - value: Current selected employee ID
 * - onChange: Callback when employee is selected (receives employee_id)
 * - onEmployeeSelect: Callback with full employee object
 * - storeId: Filter employees by store (optional)
 * - placeholder: Custom placeholder text
 * - disabled: Disable the selector
 * - showInactive: Include inactive employees
 * - className: Additional CSS classes
 */
export default function EmployeeSelector({
  value,
  onChange,
  onEmployeeSelect,
  storeId = '',
  placeholder = 'Select Employee',
  disabled = false,
  showInactive = false,
  className = ''
}) {
  const { api } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, [storeId, showInactive]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      let url = '/api/employees';
      const params = new URLSearchParams();
      if (storeId) params.append('store_id', storeId);
      if (showInactive) params.append('include_inactive', 'true');
      if (params.toString()) url += `?${params.toString()}`;
      
      const data = await api(url);
      setEmployees(data || []);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(search) ||
      emp.employee_code?.toLowerCase().includes(search) ||
      emp.email?.toLowerCase().includes(search) ||
      emp.designation?.toLowerCase().includes(search)
    );
  });

  const handleSelect = (employeeId) => {
    onChange?.(employeeId);
    const selectedEmployee = employees.find(e => e.id === employeeId);
    if (selectedEmployee) {
      onEmployeeSelect?.(selectedEmployee);
    }
  };

  const selectedEmployee = employees.find(e => e.id === value);

  return (
    <Select value={value} onValueChange={handleSelect} disabled={disabled || loading}>
      <SelectTrigger className={className} data-testid="employee-selector">
        <SelectValue placeholder={loading ? 'Loading...' : placeholder}>
          {selectedEmployee && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <span>{selectedEmployee.name}</span>
              <Badge variant="outline" className="text-xs">
                {selectedEmployee.employee_code}
              </Badge>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Search Input */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, code, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        
        {/* Employee List */}
        <div className="max-h-64 overflow-y-auto">
          {filteredEmployees.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {searchTerm ? 'No employees found' : 'No employees available'}
            </div>
          ) : (
            filteredEmployees.map((emp) => (
              <SelectItem 
                key={emp.id} 
                value={emp.id}
                className="cursor-pointer"
                data-testid={`employee-option-${emp.id}`}
              >
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{emp.name}</span>
                      {!emp.is_active && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{emp.employee_code}</span>
                      {emp.designation && (
                        <>
                          <span>•</span>
                          <span>{emp.designation}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </SelectItem>
            ))
          )}
        </div>
      </SelectContent>
    </Select>
  );
}

/**
 * Compact Employee Badge Display
 * Shows employee name and code in a badge format
 */
export function EmployeeBadge({ employee, className = '' }) {
  if (!employee) return null;
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <User className="w-4 h-4 text-gray-500" />
      <span className="font-medium">{employee.name}</span>
      <Badge variant="outline" className="text-xs">
        {employee.employee_code}
      </Badge>
    </div>
  );
}

/**
 * Employee Quick Info Card
 * Shows brief employee information
 */
export function EmployeeQuickInfo({ employee, className = '' }) {
  if (!employee) return null;
  
  return (
    <div className={`p-3 bg-gray-50 rounded-lg ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{employee.name}</p>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {employee.employee_code}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">{employee.designation || 'No designation'}</p>
          {employee.department && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
              <Building2 className="w-3 h-3" />
              {employee.department}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
