import React, { memo, useMemo, useCallback } from 'react';
import { Search, Edit, Eye, Trash2, IdCard, TrendingUp, Phone, Mail, Building2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

// Memoized employee card component
const EmployeeCard = memo(({ 
  employee, 
  stores, 
  currencySymbol, 
  onView, 
  onEdit, 
  onDelete, 
  onShowIDCard, 
  onUpgrade,
  canEdit,
  canDelete 
}) => {
  const store = useMemo(() => 
    stores.find(s => s.id === employee.store_id),
    [stores, employee.store_id]
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
              {employee.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{employee.name}</h3>
              <p className="text-sm text-gray-500">{employee.designation || 'Staff'}</p>
              <Badge variant="outline" className="mt-1 text-xs">
                {employee.employee_code}
              </Badge>
            </div>
          </div>
          <Badge variant={employee.is_active ? 'default' : 'secondary'}>
            {employee.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="mt-4 space-y-2 text-sm text-gray-600">
          {employee.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>{employee.phone}</span>
            </div>
          )}
          {employee.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span className="truncate">{employee.email}</span>
            </div>
          )}
          {store && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>{store.name}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => onView(employee.id)} data-testid={`view-employee-${employee.id}`}>
            <Eye className="w-4 h-4 mr-1" /> View
          </Button>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => onEdit(employee)} data-testid={`edit-employee-${employee.id}`}>
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onShowIDCard(employee)} data-testid={`idcard-employee-${employee.id}`}>
            <IdCard className="w-4 h-4 mr-1" /> ID
          </Button>
          <Button size="sm" variant="outline" onClick={() => onUpgrade(employee)} data-testid={`upgrade-employee-${employee.id}`}>
            <TrendingUp className="w-4 h-4 mr-1" /> Upgrade
          </Button>
          {canDelete && (
            <Button size="sm" variant="destructive" onClick={() => onDelete(employee.id)} data-testid={`delete-employee-${employee.id}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

EmployeeCard.displayName = 'EmployeeCard';

// Main list component
const EmployeesList = memo(({
  employees,
  stores,
  currencySymbol,
  searchTerm,
  onSearchChange,
  onViewProfile,
  onEdit,
  onDelete,
  onShowIDCard,
  onUpgrade,
  canEdit,
  canDelete,
  loading
}) => {
  // Memoize filtered employees
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(emp =>
      emp.name?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.phone?.includes(term) ||
      emp.employee_code?.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  // Memoize stats
  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(e => e.is_active).length,
    inactive: employees.filter(e => !e.is_active).length
  }), [employees]);

  const handleSearch = useCallback((e) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 h-48 bg-gray-100" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex gap-4 text-sm">
        <Badge variant="outline">Total: {stats.total}</Badge>
        <Badge variant="default" className="bg-green-500">Active: {stats.active}</Badge>
        <Badge variant="secondary">Inactive: {stats.inactive}</Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name, email, phone, or code..."
          value={searchTerm}
          onChange={handleSearch}
          className="pl-10"
          data-testid="employee-search"
        />
      </div>

      {/* List */}
      {filteredEmployees.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No employees found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map(employee => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              stores={stores}
              currencySymbol={currencySymbol}
              onView={onViewProfile}
              onEdit={onEdit}
              onDelete={onDelete}
              onShowIDCard={onShowIDCard}
              onUpgrade={onUpgrade}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
});

EmployeesList.displayName = 'EmployeesList';

export default EmployeesList;
