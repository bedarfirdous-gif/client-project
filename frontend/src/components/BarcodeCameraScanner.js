import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw, Zap, X } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
];

const BarcodeCameraScanner = ({ 
  onScan, 
  onClose, 
  isOpen = false 
}) => {
  const [cameras, setCameras] = useState([]);
  const [timeout, setTimeout] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  // Initialize with empty string (not null) to avoid null->value transitions that can
  // cause brief conditional UI flashes/flickers when rendering error/scan state.
  const [error, setError] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const html5QrCodeRef = useRef(null);
  const scannerContainerId = 'barcode-reader';

  // Get available cameras
  const getCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        setCameras(devices);
        // Prefer back camera (environment) for barcode scanning
        const backCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        setSelectedCamera(backCamera?.id || devices[0].id);
        setError(null);
      } else {
        setError('No cameras found on this device');
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please grant camera permission.');
    }
  }, []);

  // Initialize cameras when modal opens
  useEffect(() => {
    if (isOpen) {
      getCameras();
    }
    return () => {
      stopScanning();
    };
  }, [isOpen, getCameras]);

  // Start scanning
  const startScanning = useCallback(async () => {
    if (!selectedCamera) {
      setError('Please select a camera first');
      return;
    }

    try {
      setError(null);
      
      // Clean up any existing scanner
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          // Ignore stop errors
        }
      }

      html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      
      await html5QrCodeRef.current.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.5,
          formatsToSupport: SUPPORTED_FORMATS,
        },
        (decodedText) => {
          // Successful scan
          setLastScanned(decodedText);
          setScanCount(prev => prev + 1);
          onScan(decodedText);
          
          // Brief pause to prevent duplicate scans
          if (html5QrCodeRef.current) {
            html5QrCodeRef.current.pause(true);
            setTimeout(() => {
              if (html5QrCodeRef.current) {
                html5QrCodeRef.current.resume();
              }
            }, 1500);
          }
        },
        (errorMessage) => {
          // Scan error - ignore, it's normal when no barcode is in view
        }
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error('Failed to start scanner:', err);
      setError(`Failed to start camera: ${err.message || 'Unknown error'}`);
      setIsScanning(false);
    }
  }, [selectedCamera, onScan]);

  // Stop scanning
  const stopScanning = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Handle camera change
  const handleCameraChange = async (cameraId) => {
    setSelectedCamera(cameraId);
    if (isScanning) {
      await stopScanning();
      // Will auto-start with new camera
      setTimeout(() => startScanning(), 100);
    }
  };

  // Handle close
  const handleClose = async () => {
    await stopScanning();
    setLastScanned(null);
    setScanCount(0);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center gap-2 text-white">
            <Camera className="w-5 h-5" />
            <h3 className="font-semibold">Camera Scanner</h3>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClose}
            className="text-white hover:bg-white/20"
            data-testid="close-scanner-btn"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Camera Selection */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Select value={selectedCamera} onValueChange={handleCameraChange}>
              <SelectTrigger className="flex-1" data-testid="camera-select">
                <SelectValue placeholder="Select camera..." />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={getCameras}
              title="Refresh cameras"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Scanner View */}
        <div className="relative bg-black aspect-[4/3]">
          <div 
            id={scannerContainerId} 
            className="w-full h-full"
            style={{ minHeight: '300px' }}
          />
          
          {/* Scanning overlay when not active */}
          {!isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
              <div className="text-center">
                <CameraOff className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">Camera is not active</p>
                <Button 
                  onClick={startScanning}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="start-scanner-btn"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Start Scanning
                </Button>
              </div>
            </div>
          )}

          {/* Scan indicator */}
          {isScanning && (
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Scanning...
              </span>
              {scanCount > 0 && (
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                  {scanCount} scanned
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Last Scanned */}
        {lastScanned && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
            <p className="text-xs text-gray-500 mb-1">Last scanned:</p>
            <p className="font-mono text-green-700 dark:text-green-400 font-medium">{lastScanned}</p>
          </div>
        )}

        {/* Controls */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          {isScanning ? (
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={stopScanning}
              data-testid="stop-scanner-btn"
            >
              <CameraOff className="w-4 h-4 mr-2" />
              Stop Camera
            </Button>
          ) : (
            <Button 
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={startScanning}
              disabled={!selectedCamera}
              data-testid="start-scanner-btn"
            >
              <Camera className="w-4 h-4 mr-2" />
              Start Camera
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleClose}
          >
            Done
          </Button>
        </div>

        {/* Tips */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
          <p className="font-medium mb-1">Tips for better scanning:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Hold barcode steady within the frame</li>
            <li>Ensure good lighting</li>
            <li>Keep barcode flat and undamaged</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BarcodeCameraScanner;
