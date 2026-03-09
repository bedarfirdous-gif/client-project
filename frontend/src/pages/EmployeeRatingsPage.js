import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Star, Users, TrendingUp, Award, Calendar, Save, Filter, Search,
  ChevronLeft, ChevronRight, BarChart3, Building2, User, Clock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';

const RATING_CATEGORIES = [
  { key: 'performance', label: 'Work Performance', description: 'Quality and quantity of work delivered' },
  { key: 'punctuality', label: 'Punctuality', description: 'Attendance and time management' },
  { key: 'teamwork', label: 'Teamwork', description: 'Collaboration and team contribution' },
  { key: 'communication', label: 'Communication', description: 'Clarity and effectiveness in communication' },
  { key: 'initiative', label: 'Initiative', description: 'Proactiveness and self-motivation' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Star Rating Component
const StarRating = ({ value, onChange, readonly = false, size = 'md' }) => {
  const [hoverValue, setHoverValue] = useState(0);
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange && onChange(star)}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}`}
        >
          <Star
            className={`${sizeClasses[size]} ${
              star <= (hoverValue || value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

// Rating Badge Component
const RatingBadge = ({ rating }) => {
  const getColor = (r) => {
    if (r >= 4.5) return 'bg-emerald-500 text-white';
    if (r >= 4) return 'bg-green-500 text-white';
    if (r >= 3) return 'bg-yellow-500 text-white';
    if (r >= 2) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
  };

  const getLabel = (r) => {
    if (r >= 4.5) return 'Excellent';
    if (r >= 4) return 'Very Good';
    if (r >= 3) return 'Good';
    if (r >= 2) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <Badge className={`${getColor(rating)} text-xs`}>
      {rating.toFixed(1)} - {getLabel(rating)}
    </Badge>
  );
};

export default function EmployeeRatingsPage() {
  const { api, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [showRatingModal, setShowRatingModal] = useState(false);
  // Fix: avoid null initial state which can cause a brief "no employee selected" render path
  // (and corresponding UI flash) before the modal receives its employee data.
  // Use a stable empty-object sentinel instead.
  const [selectedEmployee, setSelectedEmployee] = useState({});
  const [newRating, setNewRating] = useState({
    performance: 0,
    punctuality: 0,
    teamwork: 0,
    communication: 0,
    initiative: 0,
    comments: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchEmployees();
      fetchRatings();
    }
  }, [selectedStore, selectedMonth, selectedYear]);

  const fetchStores = async () => {
    try {
      const data = await api('/api/stores');
      setStores(data);
      if (user?.store_ids?.length > 0) {
        setSelectedStore(user.store_ids[0]);
      } else if (data.length > 0) {
        setSelectedStore(data[0].id);
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
      toast.error('Failed to load employees');
    }
  };

  const fetchRatings = async () => {
    try {
      const data = await api(`/api/employee-ratings?store_id=${selectedStore}&month=${selectedMonth + 1}&year=${selectedYear}`);
      setRatings(data);
    } catch (err) {
      // Ratings endpoint might not exist yet, ignore error
      setRatings([]);
    }
  };

  const openRatingModal = (employee) => {
    setSelectedEmployee(employee);
    
    // Check if there's an existing rating for this month
    const existingRating = ratings.find(r => r.employee_id === employee.id);
    if (existingRating) {
      setNewRating({
        performance: existingRating.performance || 0,
        punctuality: existingRating.punctuality || 0,
        teamwork: existingRating.teamwork || 0,
        communication: existingRating.communication || 0,
        initiative: existingRating.initiative || 0,
        comments: existingRating.comments || ''
      });
    } else {
      setNewRating({
        performance: 0,
        punctuality: 0,
        teamwork: 0,
        communication: 0,
        initiative: 0,
        comments: ''
      });
    }
    setShowRatingModal(true);
  };

  const saveRating = async () => {
    if (!selectedEmployee) return;

    // Validate at least one rating is given
    const ratingValues = [newRating.performance, newRating.punctuality, newRating.teamwork, newRating.communication, newRating.initiative];
    if (ratingValues.every(v => v === 0)) {
      toast.error('Please provide at least one rating');
      return;
    }

    setSaving(true);
    try {
      await api('/api/employee-ratings', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: selectedEmployee.id,
          store_id: selectedStore,
          month: selectedMonth + 1,
          year: selectedYear,
          ...newRating
        })
      });
      toast.success(`Rating saved for ${selectedEmployee.name}`);
      setShowRatingModal(false);
      fetchRatings();
    } catch (err) {
      toast.error('Failed to save rating: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getEmployeeRating = (employeeId) => {
    const rating = ratings.find(r => r.employee_id === employeeId);
    if (!rating) return null;
    
    const values = [rating.performance, rating.punctuality, rating.teamwork, rating.communication, rating.initiative].filter(v => v > 0);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };

  const getAverageRating = (rating) => {
    if (!rating) return 0;
    const values = [rating.performance, rating.punctuality, rating.teamwork, rating.communication, rating.initiative].filter(v => v > 0);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };

  const currentAverage = getAverageRating(newRating);

  // Filter employees
  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats
  const totalEmployees = employees.length;
  const ratedEmployees = ratings.length;
  const avgOverallRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + getAverageRating(r), 0) / ratings.length
    : 0;
  const topPerformers = [...employees]
    .map(e => ({ ...e, rating: getEmployeeRating(e.id) || 0 }))
    .filter(e => e.rating > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  const changeMonth = (direction) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="employee-ratings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500" />
            Employee Ratings
          </h1>
          <p className="text-muted-foreground">Rate and track employee performance</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-44">
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

      {/* Month Navigation */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold">
                {MONTHS[selectedMonth]} {selectedYear}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => changeMonth(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-bold text-blue-600">{totalEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rated</p>
                <p className="text-2xl font-bold text-green-600">{ratedEmployees}/{totalEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
                <p className="text-2xl font-bold text-yellow-600">{avgOverallRating.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500">
                <Award className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Top Performer</p>
                <p className="text-lg font-bold text-purple-600 truncate">
                  {topPerformers[0]?.name || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers Section */}
      {topPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              Top Performers - {MONTHS[selectedMonth]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topPerformers.map((emp, idx) => (
                <div
                  key={emp.id}
                  className={`p-4 rounded-lg border-2 ${
                    idx === 0 ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20' :
                    idx === 1 ? 'border-gray-300 bg-gray-50 dark:bg-gray-950/20' :
                    'border-amber-600 bg-amber-50 dark:bg-amber-950/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      idx === 0 ? 'bg-yellow-500' :
                      idx === 1 ? 'bg-gray-400' :
                      'bg-amber-600'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.department || 'General'}</p>
                    </div>
                    <div className="text-right">
                      <StarRating value={Math.round(emp.rating)} readonly size="sm" />
                      <p className="text-sm font-bold text-yellow-600">{emp.rating.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Employee List */}
      <div className="grid gap-4">
        {filteredEmployees.map((emp) => {
          const empRating = ratings.find(r => r.employee_id === emp.id);
          const avgRating = getAverageRating(empRating);
          
          return (
            <Card key={emp.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Employee Info */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                      avgRating >= 4 ? 'bg-green-500' :
                      avgRating >= 3 ? 'bg-yellow-500' :
                      avgRating > 0 ? 'bg-orange-500' :
                      'bg-gray-400'
                    }`}>
                      {emp.name?.charAt(0)?.toUpperCase() || '#'}
                    </div>
                    <div>
                      <p className="font-semibold">{emp.name}</p>
                      <p className="text-sm text-muted-foreground">{emp.department || 'General'}</p>
                      <p className="text-xs text-muted-foreground">{emp.designation || emp.employee_code}</p>
                    </div>
                  </div>

                  {/* Rating Display */}
                  <div className="flex-1">
                    {empRating ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <StarRating value={Math.round(avgRating)} readonly />
                          <RatingBadge rating={avgRating} />
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-xs">
                          {RATING_CATEGORIES.map(cat => (
                            <div key={cat.key} className="text-center">
                              <p className="text-muted-foreground truncate">{cat.label}</p>
                              <p className="font-semibold">{empRating[cat.key] || '-'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground italic">
                        Not rated for {MONTHS[selectedMonth]}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div>
                    <Button onClick={() => openRatingModal(emp)}>
                      <Star className="w-4 h-4 mr-2" />
                      {empRating ? 'Update Rating' : 'Rate Employee'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredEmployees.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Employees Found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try a different search term' : 'Add employees to start rating'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rating Modal */}
      <Dialog open={showRatingModal} onOpenChange={setShowRatingModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Rate {selectedEmployee?.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {MONTHS[selectedMonth]} {selectedYear} Performance Review
            </p>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Overall Rating Preview */}
            <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Overall Rating</p>
              <div className="flex justify-center mb-2">
                <StarRating value={Math.round(currentAverage)} readonly size="lg" />
              </div>
              <p className="text-2xl font-bold text-yellow-600">{currentAverage.toFixed(1)} / 5.0</p>
              {currentAverage > 0 && <RatingBadge rating={currentAverage} />}
            </div>

            {/* Rating Categories */}
            <div className="space-y-4">
              {RATING_CATEGORIES.map(cat => (
                <div key={cat.key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="font-medium">{cat.label}</Label>
                      <p className="text-xs text-muted-foreground">{cat.description}</p>
                    </div>
                    <StarRating
                      value={newRating[cat.key]}
                      onChange={(val) => setNewRating(prev => ({ ...prev, [cat.key]: val }))}
                    />
                  </div>
                  <Progress 
                    value={(newRating[cat.key] / 5) * 100} 
                    className={`h-2 ${
                      newRating[cat.key] >= 4 ? '[&>div]:bg-green-500' :
                      newRating[cat.key] >= 3 ? '[&>div]:bg-yellow-500' :
                      newRating[cat.key] >= 1 ? '[&>div]:bg-orange-500' :
                      ''
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label>Comments (Optional)</Label>
              <Textarea
                placeholder="Add any additional feedback or notes..."
                value={newRating.comments}
                onChange={(e) => setNewRating(prev => ({ ...prev, comments: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRatingModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveRating} disabled={saving} className="bg-yellow-500 hover:bg-yellow-600">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
