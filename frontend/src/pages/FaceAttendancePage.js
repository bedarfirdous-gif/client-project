import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Camera, CameraOff, UserCheck, Clock, RefreshCw, Users, 
  CheckCircle, XCircle, AlertTriangle, Scan, Video, Building2, Upload, ImageIcon, Settings, Zap, Gauge, QrCode
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import QRScannerDialog from '../components/QRScannerDialog';

export default function FaceAttendancePage() {
  const { api, user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Fix: avoid null-initialized UI state which can cause conditional sections to mount/unmount (flash)
  // Use stable initial values + explicit "loaded" flags where applicable.
  const [cameraError, setCameraError] = useState('');
  const [hasCameraError, setHasCameraError] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('attendance'); // 'attendance' | 'register'
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const [verificationResult, setVerificationResult] = useState({});
  const [hasVerificationResult, setHasVerificationResult] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState([]);

  const [uploadedImage, setUploadedImage] = useState('');
  const [hasUploadedImage, setHasUploadedImage] = useState(false);

  const [showQRScanner, setShowQRScanner] = useState(false);
  const streamRef = useRef(null);

  // Camera detection state
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  
  // Face recognition model state
  const [faceModels, setFaceModels] = useState([]);
  const [currentModel, setCurrentModel] = useState('');
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [changingModel, setChangingModel] = useState(false);

  // Fetch face models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const data = await api('/api/face-attendance/models');
        setFaceModels(data.models || []);
        setCurrentModel(data.current_model || '');
      } catch (err) {
        console.error('Failed to fetch face models');
      }
    };
    fetchModels();
  }, []);

  // Change face model
  const handleChangeModel = async (modelId) => {
    setChangingModel(true);
    try {
      const result = await api('/api/face-attendance/models/change', {
        method: 'POST',
        body: JSON.stringify({ model: modelId })
      });
      if (result.success) {
        setCurrentModel(modelId);
        toast.success(`Switched to ${modelId} model (${result.accuracy} accuracy)`);
        setShowModelDialog(false);
      } else {
        toast.error(result.error || 'Failed to change model');
      }
    } catch (err) {
      toast.error('Failed to change model');
    } finally {
      setChangingModel(false);
    }
  };

  // Detect available cameras
  useEffect(() => {
    const detectCameras = async () => {
      try {
        // Request permission first
        await navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
          stream.getTracks().forEach(track => track.stop());
        }).catch(() => {});
        
        // Get all video devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        // Set default camera
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
        
        console.log('Available cameras:', videoDevices.length);
      } catch (err) {
        console.error('Failed to detect cameras:', err);
      }
    };
    
    detectCameras();
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchData();
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchTodayAttendance();
    }
  }, [selectedStore]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empData, storesData, regData] = await Promise.all([
        api('/api/employees'),
        api('/api/stores'),
        api('/api/face-attendance/registrations')
      ]);
      setEmployees(empData.filter(e => e.is_active !== false));
      
      // Filter stores based on user's assigned stores
      // Superadmin sees all stores, others only see their assigned stores
      let userStores = storesData;
      if (user?.role !== 'superadmin' && user?.store_ids?.length > 0) {
        userStores = storesData.filter(s => user.store_ids.includes(s.id));
      } else if (user?.store_id) {
        // Single store assignment
        userStores = storesData.filter(s => s.id === user.store_id);
      }
      
      setStores(userStores);
      setRegistrations(regData.registrations || []);
      
      // Set default store (user's assigned store or first available)
      if (userStores.length > 0) {
        setSelectedStore(userStores[0].id);
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await api(`/api/attendance?date=${today}&store_id=${selectedStore}`);
      setTodayAttendance(data);
    } catch (err) {
      console.error('Failed to fetch attendance');
    }
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Your browser does not support camera access. Please use Chrome, Firefox, or Edge, and ensure you are on HTTPS.');
        toast.error('Camera not supported in this browser');
        return;
      }
      
      // Build video constraints with selected camera
      let videoConstraints = {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      };
      
      // If a specific camera is selected, use it
      if (selectedCamera) {
        videoConstraints = {
          deviceId: { exact: selectedCamera }
        };
      }
      
      console.log('Requesting camera with constraints:', videoConstraints);
      
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
      
      console.log('Camera stream obtained:', stream.getVideoTracks());
      
      if (videoRef.current) {
        // Stop any existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Set the new stream
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Important: Play the video
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(() => {
              console.log('Video playing');
              setCameraActive(true);
              toast.success('Camera started successfully');
            })
            .catch(err => {
              console.error('Error playing video:', err);
              setCameraError('Failed to play camera stream');
            });
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      let errorMessage = 'Unable to access camera.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings and refresh the page.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera is being used by another application. Please close other apps using the camera.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not meet requirements. Trying with default settings...';
        // Try with minimal constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            streamRef.current = fallbackStream;
            setCameraActive(true);
            toast.success('Camera started with fallback settings');
            return;
          }
        } catch (fallbackErr) {
          errorMessage = 'Could not start camera even with minimal settings.';
        }
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Camera access blocked due to security restrictions. This feature requires HTTPS.';
      }
      
      setCameraError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureImage = () => {
    // Return uploaded image if available
    if (uploadedImage) {
      return uploadedImage;
    }
    
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  // Handle file upload for fallback
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target.result);
      setCameraActive(true); // Treat uploaded image as "camera ready"
      toast.success('Photo uploaded successfully');
    };
    reader.onerror = () => {
      toast.error('Failed to read the image file');
    };
    reader.readAsDataURL(file);
  };

  const clearUploadedImage = () => {
    setUploadedImage(null);
    setCameraActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleVerifyAndMark = async () => {
    if (!cameraActive && !uploadedImage) {
      toast.error('Please start the camera or upload a photo');
      return;
    }
    
    if (!selectedStore) {
      toast.error('Please select a store');
      return;
    }
    
    setProcessing(true);
    setVerificationResult(null);
    
    try {
      const imageData = captureImage();
      if (!imageData) {
        toast.error('Failed to capture image');
        return;
      }
      
      // First verify the face
      const verifyResult = await api('/api/face-attendance/verify', {
        method: 'POST',
        body: JSON.stringify({ image: imageData })
      });
      
      if (verifyResult.matched) {
        // Mark attendance
        const markResult = await api('/api/face-attendance/mark', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: verifyResult.employee_id,
            store_id: selectedStore,
            image: imageData
          })
        });
        
        setVerificationResult({
          success: true,
          matched: true,
          employee_name: verifyResult.employee_name,
          employee_code: verifyResult.employee_code,
          confidence: verifyResult.confidence,
          action: markResult.action,
          message: markResult.message
        });
        
        toast.success(markResult.message);
        fetchTodayAttendance();
      } else {
        setVerificationResult({
          success: false,
          matched: false,
          confidence: verifyResult.confidence,
          message: verifyResult.error || 'Face not recognized'
        });
        toast.error(verifyResult.error || 'Face not recognized');
      }
    } catch (err) {
      toast.error(err.message || 'Verification failed');
      setVerificationResult({
        success: false,
        matched: false,
        message: err.message || 'Verification failed'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRegisterFace = async () => {
    if (!cameraActive) {
      toast.error('Please start the camera first');
      return;
    }
    
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }
    
    setProcessing(true);
    
    try {
      const imageData = captureImage();
      if (!imageData) {
        toast.error('Failed to capture image');
        return;
      }
      
      const result = await api('/api/face-attendance/register', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: selectedEmployee,
          image: imageData
        })
      });
      
      toast.success('Face registered successfully');
      setShowRegisterDialog(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setProcessing(false);
    }
  };

  const isEmployeeRegistered = (employeeId) => {
    return registrations.some(r => r.employee_id === employeeId);
  };

  const getEmployeeAttendance = (employeeId) => {
    return todayAttendance.find(a => a.employee_id === employeeId);
  };

  const getStoreName = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    return store?.name || 'Unknown Store';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="face-attendance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scan className="w-6 h-6 text-primary" />
            Face Recognition Attendance
          </h1>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <span>Mark attendance using face recognition</span>
            {currentModel && (
              <Badge variant="outline" className="text-xs">
                Model: {currentModel}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => setShowQRScanner(true)}
            className="bg-purple-600 hover:bg-purple-700"
            data-testid="qr-scanner-btn"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Scan ID Card
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowModelDialog(true)}
            data-testid="model-settings-btn"
          >
            <Settings className="w-4 h-4 mr-2" />
            AI Model
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowRegisterDialog(true)}
            data-testid="register-face-btn"
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Register Face
          </Button>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Store Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <Label>Store</Label>
              {stores.length === 1 ? (
                // Single store - show as text (no dropdown needed)
                <div className="mt-1 font-medium text-lg">{stores[0]?.name}</div>
              ) : stores.length > 1 ? (
                // Multiple stores - show dropdown
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="w-full sm:w-64" data-testid="store-select">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                // No stores assigned
                <div className="mt-1 text-sm text-muted-foreground">No store assigned</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Section */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Camera / Photo
              </span>
              {availableCameras.length > 1 && (
                <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCameras.map((cam, index) => (
                      <SelectItem key={cam.deviceId} value={cam.deviceId}>
                        {cam.label || `Camera ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardTitle>
            {availableCameras.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {availableCameras.length} camera(s) detected
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Camera View or Uploaded Image */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
              {uploadedImage ? (
                <img loading="lazy" 
                  src={uploadedImage} 
                  alt="Uploaded face" 
                  className="w-full h-full object-cover"
                />
              ) : cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <CameraOff className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-sm opacity-75">Camera is off</p>
                  {cameraError && (
                    <p className="text-xs text-red-400 mt-2 text-center px-4 max-w-[90%]">{cameraError}</p>
                  )}
                </div>
              )}
              
              {/* Face Detection Overlay */}
              {(cameraActive || uploadedImage) && !uploadedImage && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-56 border-2 border-dashed border-green-400 rounded-xl opacity-50"></div>
                </div>
              )}
              
              {/* Processing Overlay */}
              {processing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm">Processing...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Hidden Canvas for Capture */}
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*"
              capture="user"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {/* Camera Controls */}
            <div className="flex flex-col gap-2">
              {uploadedImage ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearUploadedImage} className="flex-1">
                    <XCircle className="w-4 h-4 mr-2" />
                    Clear Photo
                  </Button>
                  <Button 
                    onClick={handleVerifyAndMark} 
                    disabled={processing}
                    className="flex-1"
                    data-testid="scan-face-btn"
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    Verify Face
                  </Button>
                </div>
              ) : !cameraActive ? (
                <div className="flex gap-2">
                  <Button onClick={startCamera} className="flex-1" data-testid="start-camera-btn">
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="flex-1"
                    data-testid="upload-photo-btn"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={stopCamera} className="flex-1">
                    <CameraOff className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                  <Button 
                    onClick={handleVerifyAndMark} 
                    disabled={processing}
                    className="flex-1"
                    data-testid="scan-face-btn"
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    Scan Face
                  </Button>
                </div>
              )}
            </div>
            
            {/* Verification Result */}
            {verificationResult && (
              <div className={`p-4 rounded-lg ${
                verificationResult.success && verificationResult.matched 
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {verificationResult.success && verificationResult.matched ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  )}
                  <div>
                    {verificationResult.matched ? (
                      <>
                        <p className="font-semibold text-green-800">
                          {verificationResult.employee_name}
                        </p>
                        <p className="text-sm text-green-600">
                          {verificationResult.employee_code} • Confidence: {verificationResult.confidence}%
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          {verificationResult.action === 'checkin' ? '✓ Check-in' : '✓ Check-out'} recorded
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-red-800">Face Not Recognized</p>
                        <p className="text-sm text-red-600">{verificationResult.message}</p>
                        {verificationResult.confidence > 0 && (
                          <p className="text-xs text-red-500 mt-1">
                            Confidence: {verificationResult.confidence}% (threshold: 60%)
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Attendance */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Today's Attendance
              </span>
              <Badge variant="outline">
                {todayAttendance.length}/{employees.filter(e => !selectedStore || e.store_id === selectedStore).length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {employees
                .filter(e => !selectedStore || e.store_id === selectedStore)
                .map(emp => {
                  const attendance = getEmployeeAttendance(emp.id);
                  const isRegistered = isEmployeeRegistered(emp.id);
                  
                  return (
                    <div 
                      key={emp.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                          {emp.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{emp.employee_code}</span>
                            {isRegistered ? (
                              <Badge variant="outline" className="text-green-600 border-green-300">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Face Registered
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Not Registered
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {attendance ? (
                          <div>
                            <Badge className={
                              attendance.status === 'present' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }>
                              {attendance.status}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              In: {attendance.in_time || '-'}
                              {attendance.out_time && ` | Out: ${attendance.out_time}`}
                            </div>
                            {attendance.method === 'face_recognition' && (
                              <div className="text-xs text-blue-600">
                                <Scan className="w-3 h-3 inline mr-1" />
                                Face Scan
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary">Not Marked</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Registered Faces Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Registered Faces ({registrations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {registrations.map(reg => (
              <div 
                key={reg.id}
                className="text-center p-3 rounded-lg bg-accent/30"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-medium truncate">{reg.employee_name}</p>
                <p className="text-xs text-muted-foreground">{reg.employee_code}</p>
              </div>
            ))}
            {registrations.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No faces registered yet</p>
                <p className="text-sm">Click "Register Face" to add employees</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Register Face Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Register Employee Face</DialogTitle>
            <DialogDescription>
              Select an employee and capture their face for attendance recognition
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Employee Selection */}
            <div className="space-y-2">
              <Label>Select Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger data-testid="register-employee-select">
                  <SelectValue placeholder="Select employee to register" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex items-center gap-2">
                        <span>{emp.name}</span>
                        <span className="text-muted-foreground">({emp.employee_code})</span>
                        {isEmployeeRegistered(emp.id) && (
                          <Badge variant="outline" className="text-green-600">Registered</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Camera Preview or Uploaded Image */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
              {uploadedImage ? (
                <img loading="lazy" 
                  src={uploadedImage} 
                  alt="Uploaded face" 
                  className="w-full h-full object-cover"
                />
              ) : cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <Camera className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-sm opacity-75">Start camera to capture face</p>
                  <p className="text-xs opacity-50 mt-2">or upload a photo</p>
                  {cameraError && (
                    <p className="text-xs text-red-400 mt-2 text-center px-4 max-w-[90%]">{cameraError}</p>
                  )}
                </div>
              )}
              
              {/* Face Guide */}
              {cameraActive && !uploadedImage && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-48 border-2 border-dashed border-blue-400 rounded-xl"></div>
                </div>
              )}
            </div>
            
            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">Instructions:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Ensure good lighting on your face</li>
                <li>Look directly at the camera</li>
                <li>Remove glasses if possible</li>
                <li>Keep a neutral expression</li>
                <li>If camera doesn't work, use "Upload Photo" option</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            {uploadedImage ? (
              <>
                <Button variant="outline" onClick={clearUploadedImage}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Clear
                </Button>
                <Button 
                  onClick={handleRegisterFace}
                  disabled={!selectedEmployee || processing}
                  data-testid="capture-register-btn"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Register Face
                    </>
                  )}
                </Button>
              </>
            ) : !cameraActive ? (
              <>
                <Button onClick={startCamera} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={stopCamera}>
                  <CameraOff className="w-4 h-4 mr-2" />
                  Stop
                </Button>
                <Button 
                  onClick={handleRegisterFace}
                  disabled={!selectedEmployee || processing}
                  data-testid="capture-register-btn"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Capture & Register
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Model Selection Dialog */}
      <Dialog open={showModelDialog} onOpenChange={setShowModelDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Face Recognition AI Model
            </DialogTitle>
            <DialogDescription>
              Select the AI model for face recognition. Higher accuracy models may be slower.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
            {faceModels.map((model) => (
              <Card 
                key={model.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  model.id === currentModel 
                    ? 'border-2 border-primary bg-primary/5' 
                    : 'hover:border-primary/50'
                }`}
                onClick={() => !changingModel && handleChangeModel(model.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        model.id === currentModel 
                          ? 'bg-primary text-white' 
                          : 'bg-muted'
                      }`}>
                        {model.id === 'ArcFace' && <Zap className="w-5 h-5" />}
                        {model.id === 'Facenet512' && <Gauge className="w-5 h-5" />}
                        {model.id === 'Facenet' && <Scan className="w-5 h-5" />}
                        {!['ArcFace', 'Facenet512', 'Facenet'].includes(model.id) && <Scan className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          {model.name}
                          {model.id === currentModel && (
                            <Badge className="bg-primary">Current</Badge>
                          )}
                          {model.id === 'ArcFace' && (
                            <Badge variant="outline" className="text-green-600 border-green-300">Recommended</Badge>
                          )}
                        </h4>
                        <p className="text-sm text-muted-foreground">{model.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">{model.accuracy}</div>
                      <div className="text-xs text-muted-foreground">{model.speed}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModelDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Scanner Dialog for Attendance */}
      <QRScannerDialog 
        open={showQRScanner} 
        onClose={() => {
          setShowQRScanner(false);
          fetchTodayAttendance(); // Refresh attendance after scanning
        }}
        mode="employee"
      />
    </div>
  );
}
