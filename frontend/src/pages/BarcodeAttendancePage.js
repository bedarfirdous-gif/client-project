import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { 
  Barcode, 
  CheckCircle2, 
  LogIn, 
  LogOut, 
  User, 
  Clock, 
  AlertCircle,
  RefreshCw,
  History,
  Scan
} from 'lucide-react';
import { useAuth } from '../App';

export default function BarcodeAttendancePage() {
  const { api } = useAuth();
  const [employeeCode, setEmployeeCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const inputRef = useRef(null);

  // Auto-focus input for scanner
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Process barcode scan
  const processScan = useCallback(async (code) => {
    if (!code || code.trim().length < 3) {
      toast.error('Invalid barcode');
      return;
    }

    setScanning(true);
    try {
      const result = await api('/api/attendance/scan-barcode', {
        method: 'POST',
        body: JSON.stringify({ employee_code: code.trim() })
      });

      setLastScan(result);
      
      // Add to recent scans (keep last 10)
      setRecentScans(prev => [
        { ...result, timestamp: new Date().toISOString() },
        ...prev.slice(0, 9)
      ]);

      // Show appropriate toast
      if (result.action === 'check_in') {
        toast.success(`✓ Check-in: ${result.employee.name}`, {
          description: `Time: ${new Date(result.attendance.check_in).toLocaleTimeString()}`
        });
      } else if (result.action === 'check_out') {
        toast.success(`✓ Check-out: ${result.employee.name}`, {
          description: `Total hours: ${result.attendance.total_hours?.toFixed(2) || 'N/A'}`
        });
      } else if (result.action === 'already_completed') {
        toast.info(`${result.employee.name} - Already completed for today`);
      }

      // Clear input for next scan
      setEmployeeCode('');
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err.message || 'Scan failed');
      setLastScan({ error: err.message });
    } finally {
      setScanning(false);
    }
  }, [api]);

  // Handle manual submit
  const handleSubmit = (e) => {
    e.preventDefault();
    processScan(employeeCode);
  };

  // Handle input change (for barcode scanner auto-submit)
  const handleInputChange = (e) => {
    const value = e.target.value;
    setEmployeeCode(value);
    
    // Auto-submit after scanner input (usually ends with Enter)
    // Most barcode scanners send characters quickly followed by Enter
  };

  // Handle Enter key from scanner
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && employeeCode.trim()) {
      e.preventDefault();
      processScan(employeeCode);
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white mb-4 shadow-lg">
            <Barcode className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Barcode Attendance</h1>
          <p className="text-gray-500 mt-2">Scan employee barcode to mark attendance</p>
        </div>

        {/* Scanner Input Card */}
        <Card className="border-2 border-dashed border-blue-200 bg-blue-50/50">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="barcode" className="text-lg font-medium text-gray-700 mb-2 block">
                    <Scan className="w-5 h-5 inline mr-2" />
                    Scan or Enter Employee Code
                  </Label>
                  <Input
                    ref={inputRef}
                    id="barcode"
                    type="text"
                    value={employeeCode}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Scan barcode or type employee code..."
                    className="text-2xl h-16 text-center font-mono tracking-wider"
                    autoFocus
                    autoComplete="off"
                    data-testid="barcode-input"
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg"
                  disabled={scanning || !employeeCode.trim()}
                  className="h-16 px-8 text-lg"
                  data-testid="scan-submit-btn"
                >
                  {scanning ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6 mr-2" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-gray-500 text-center">
                Position barcode scanner cursor here. Scans auto-submit on Enter key.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Last Scan Result */}
        {lastScan && !lastScan.error && (
          <Card className={`border-2 ${
            lastScan.action === 'check_in' ? 'border-green-400 bg-green-50' : 
            lastScan.action === 'check_out' ? 'border-blue-400 bg-blue-50' : 
            'border-amber-400 bg-amber-50'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                {/* Employee Photo or Avatar */}
                <div className="flex-shrink-0">
                  {lastScan.employee?.photo ? (
                    <img loading="lazy" 
                      src={lastScan.employee.photo} 
                      alt={lastScan.employee.name}
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center border-4 border-white shadow-lg">
                      <User className="w-12 h-12 text-white" />
                    </div>
                  )}
                </div>

                {/* Scan Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {lastScan.employee?.name}
                    </h3>
                    <Badge className={`text-sm ${
                      lastScan.action === 'check_in' ? 'bg-green-500' : 
                      lastScan.action === 'check_out' ? 'bg-blue-500' : 
                      'bg-amber-500'
                    }`}>
                      {lastScan.action === 'check_in' ? (
                        <><LogIn className="w-4 h-4 mr-1" /> CHECK IN</>
                      ) : lastScan.action === 'check_out' ? (
                        <><LogOut className="w-4 h-4 mr-1" /> CHECK OUT</>
                      ) : (
                        'COMPLETED'
                      )}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Employee Code:</span>
                      <span className="ml-2 font-mono font-semibold">{lastScan.employee?.employee_code}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Department:</span>
                      <span className="ml-2 font-medium">{lastScan.employee?.department || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Designation:</span>
                      <span className="ml-2 font-medium">{lastScan.employee?.designation || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Time:</span>
                      <span className="ml-2 font-medium">
                        {lastScan.action === 'check_in' 
                          ? formatTime(lastScan.attendance?.check_in)
                          : formatTime(lastScan.attendance?.check_out)
                        }
                      </span>
                    </div>
                  </div>

                  {lastScan.attendance?.total_hours && (
                    <div className="mt-3 p-2 bg-white/50 rounded-lg inline-block">
                      <Clock className="w-4 h-4 inline mr-2 text-gray-600" />
                      <span className="text-gray-600">Total Hours:</span>
                      <span className="ml-2 font-bold text-lg">{lastScan.attendance.total_hours.toFixed(2)}</span>
                    </div>
                  )}

                  {lastScan.attendance?.late_hours > 0 && (
                    <div className="mt-2 text-amber-600 text-sm">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      Late by {lastScan.attendance.late_hours.toFixed(2)} hours
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {lastScan?.error && (
          <Card className="border-2 border-red-400 bg-red-50">
            <CardContent className="p-6 flex items-center gap-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <div>
                <h3 className="text-lg font-semibold text-red-700">Scan Failed</h3>
                <p className="text-red-600">{lastScan.error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="w-5 h-5" />
                Recent Scans
              </CardTitle>
              <CardDescription>Last {recentScans.length} attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentScans.map((scan, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      scan.action === 'check_in' ? 'bg-green-50' : 
                      scan.action === 'check_out' ? 'bg-blue-50' : 
                      'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        scan.action === 'check_in' ? 'bg-green-500' : 
                        scan.action === 'check_out' ? 'bg-blue-500' : 
                        'bg-gray-400'
                      }`} />
                      <span className="font-medium">{scan.employee?.name}</span>
                      <span className="text-sm text-gray-500 font-mono">
                        ({scan.employee?.employee_code})
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="text-xs">
                        {scan.action === 'check_in' ? 'IN' : scan.action === 'check_out' ? 'OUT' : '✓'}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {formatTime(scan.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-gray-50">
          <CardContent className="p-6">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Barcode className="w-5 h-5" />
              How to use
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Connect your barcode scanner to this device</li>
              <li>Click on the input field above (or it auto-focuses)</li>
              <li>Scan the employee's ID card barcode</li>
              <li>System automatically marks Check-In or Check-Out based on current status</li>
              <li>View confirmation and recent scan history below</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
