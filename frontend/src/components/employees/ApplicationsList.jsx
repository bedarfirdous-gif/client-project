import React, { memo, useMemo, useCallback } from 'react';
import { Clock, Eye, CheckCircle, XCircle, FileText, UserPlus, Edit, Trash2, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

const STATUS_CONFIG = {
  pending_review: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-700', icon: Eye },
  documents_pending: { label: 'Documents Pending', color: 'bg-orange-100 text-orange-700', icon: FileText },
  interview_scheduled: { label: 'Interview Scheduled', color: 'bg-purple-100 text-purple-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  converted_to_employee: { label: 'Converted', color: 'bg-gray-100 text-gray-700', icon: UserPlus }
};

// Memoized application card
const ApplicationCard = memo(({ 
  application, 
  stores, 
  onView, 
  onEdit, 
  onConvert, 
  onDelete, 
  onDownload 
}) => {
  const status = STATUS_CONFIG[application.status] || STATUS_CONFIG.pending_review;
  const StatusIcon = status.icon;
  
  const store = useMemo(() => 
    stores.find(s => s.id === application.preferred_store),
    [stores, application.preferred_store]
  );

  const canConvert = application.status === 'approved';
  const isConverted = application.status === 'converted_to_employee';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{application.full_name}</h3>
            <p className="text-sm text-gray-500">{application.position_applied}</p>
          </div>
          <Badge className={status.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {status.label}
          </Badge>
        </div>

        <div className="mt-3 space-y-1 text-sm text-gray-600">
          <p>{application.contact_number}</p>
          <p className="truncate">{application.email}</p>
          {store && <p className="text-blue-600">{store.name}</p>}
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => onView(application)} data-testid={`view-app-${application.id}`}>
            <Eye className="w-4 h-4 mr-1" /> View
          </Button>
          
          {!isConverted && (
            <Button size="sm" variant="outline" onClick={() => onEdit(application)} data-testid={`edit-app-${application.id}`}>
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
          
          {canConvert && (
            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => onConvert(application)} data-testid={`convert-app-${application.id}`}>
              <UserPlus className="w-4 h-4 mr-1" /> Convert
            </Button>
          )}
          
          <Button size="sm" variant="outline" onClick={() => onDownload(application)} data-testid={`download-app-${application.id}`}>
            <Download className="w-4 h-4" />
          </Button>
          
          {!isConverted && (
            <Button size="sm" variant="destructive" onClick={() => onDelete(application.id)} data-testid={`delete-app-${application.id}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

ApplicationCard.displayName = 'ApplicationCard';

// Main list component
const ApplicationsList = memo(({
  applications,
  stores,
  statusFilter,
  onStatusFilterChange,
  onView,
  onEdit,
  onConvert,
  onDelete,
  onDownload,
  loading
}) => {
  // Memoize filtered applications
  const filteredApplications = useMemo(() => {
    if (!statusFilter || statusFilter === 'all') return applications;
    return applications.filter(app => app.status === statusFilter);
  }, [applications, statusFilter]);

  // Memoize stats
  const stats = useMemo(() => ({
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending_review').length,
    approved: applications.filter(a => a.status === 'approved').length,
    converted: applications.filter(a => a.status === 'converted_to_employee').length
  }), [applications]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 h-40 bg-gray-100" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex gap-4 text-sm flex-wrap">
        <Badge variant="outline">Total: {stats.total}</Badge>
        <Badge className="bg-yellow-100 text-yellow-700">Pending: {stats.pending}</Badge>
        <Badge className="bg-green-100 text-green-700">Approved: {stats.approved}</Badge>
        <Badge className="bg-gray-100 text-gray-700">Converted: {stats.converted}</Badge>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending_review', 'under_review', 'approved', 'rejected'].map(status => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? 'default' : 'outline'}
            onClick={() => onStatusFilterChange(status)}
            data-testid={`filter-${status}`}
          >
            {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
          </Button>
        ))}
      </div>

      {/* List */}
      {filteredApplications.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No applications found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApplications.map(app => (
            <ApplicationCard
              key={app.id}
              application={app}
              stores={stores}
              onView={onView}
              onEdit={onEdit}
              onConvert={onConvert}
              onDelete={onDelete}
              onDownload={onDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
});

ApplicationsList.displayName = 'ApplicationsList';

export default ApplicationsList;
