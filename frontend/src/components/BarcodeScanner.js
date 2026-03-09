import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, FlipHorizontal, Flashlight, X, Scan, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
];

export default function BarcodeScanner({ 
  isOpen, 
  onClose, 
  onScan,
  title = "Scan Barcode",
  continuous = false // If true, keeps scanning; if false, closes after one scan
}) {
  const scannerRef = useRef(null);
  const html5QrcodeRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [torchEnabled, setTorchEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Get available cameras
      Html5Qrcode.getCameras()
        .then(devices => {
          setCameras(devices);
          // Prefer back camera
          const backCamera = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCamera(backCamera?.id || devices[0]?.id || '');
        })
        .catch(err => {
          console.error('Camera access error:', err);
          toast.error('Could not access camera');
        });
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedCamera && !isScanning) {
      startScanner();
    }
  }, [selectedCamera, isOpen]);

  const startScanner = async () => {
    if (!selectedCamera || isScanning) return;

    try {
      html5QrcodeRef.current = new Html5Qrcode("barcode-reader", {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false
      });

      await html5QrcodeRef.current.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.5,
        },
        (decodedText, decodedResult) => {
          handleScanSuccess(decodedText, decodedResult);
        },
        (errorMessage) => {
          // Ignore scan errors (no barcode found)
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Scanner start error:', err);
      toast.error('Failed to start scanner');
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current && isScanning) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.error('Scanner stop error:', err);
      }
    }
    setIsScanning(false);
  };

  const handleScanSuccess = (decodedText, decodedResult) => {
    // Avoid duplicate scans
    if (decodedText === lastScanned) return;
    
    setLastScanned(decodedText);
    
    // Play beep sound
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQoAIJ7k6ayYRwAAQL7j5IxyGAAAwNfqw4EDAAB/2/K7dQAAE5by85VjAAAou/T4qHsAAAC4+fq2jwAAA63+/r+dAAAXsQD/yKUAALTA/P/OpQAAOsj8/9OmAADczfv/0qYAAOPR+//PpQAA89T6/8ulAAD/2Pn/xqMAAP/c+P/BoAAA/+D3/7ydAAD/5Pb/t5oAAP/n9f+ylgAA/+r0/62SAAD/7PP/qI4AAP/u8v+jigAA//Dx/56GAAD/8vD/mYIAAP/07/+UfgAA//bt/494AAD/+Ov/iXQAAP/56v+EcAAA//ro/35rAAD/++f/eGcAAP/85f9yYgAA//3k/2xeAAD//uL/ZlkAAP/+4P9gVAAA//7e/1pPAAD//tz/VEoAAP/+2v9ORQAA//7Y/0hAAAD//tb/Qjs=');
    audio.volume = 0.3;
    audio.play().catch(() => {});

    if (continuous) {
      // Add to scanned items list
      setScannedItems(prev => {
        const exists = prev.find(item => item.code === decodedText);
        if (exists) {
          return prev.map(item => 
            item.code === decodedText 
              ? { ...item, count: item.count + 1 }
              : item
          );
        }
        return [...prev, { code: decodedText, count: 1, format: decodedResult.result.format.formatName }];
      });
      
      // Notify parent
      onScan(decodedText, decodedResult);
      
      // Reset last scanned after 1.5s to allow same code again
      setTimeout(() => setLastScanned(''), 1500);
    } else {
      // Single scan mode - close after scan
      onScan(decodedText, decodedResult);
      handleClose();
    }
  };

  const handleClose = async () => {
    await stopScanner();
    setScannedItems([]);
    setLastScanned('');
    onClose();
  };

  const switchCamera = () => {
    const currentIndex = cameras.findIndex(c => c.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    stopScanner().then(() => {
      setSelectedCamera(cameras[nextIndex].id);
    });
  };

  const toggleTorch = async () => {
    if (html5QrcodeRef.current) {
      try {
        const track = html5QrcodeRef.current.getRunningTrackSettings();
        if (track && 'torch' in track) {
          await html5QrcodeRef.current.applyVideoConstraints({
            advanced: [{ torch: !torchEnabled }]
          });
          setTorchEnabled(!torchEnabled);
        }
      } catch (err) {
        toast.error('Torch not supported on this device');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Scan className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          {/* Scanner viewport */}
          <div 
            id="barcode-reader" 
            ref={scannerRef}
            className="w-full aspect-[4/3] bg-black"
          />

          {/* Scanner overlay */}
          {!isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <Camera className="w-12 h-12 mx-auto mb-3 animate-pulse" />
                <p>Starting camera...</p>
              </div>
            </div>
          )}

          {/* Scan frame indicator */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-72 h-44 border-2 border-green-500 rounded-lg relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br" />
                {/* Scanning line animation */}
                <div className="absolute left-2 right-2 h-0.5 bg-green-400 animate-scan-line" />
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
            {cameras.length > 1 && (
              <Button 
                size="icon" 
                variant="secondary" 
                className="rounded-full bg-black/50 hover:bg-black/70"
                onClick={switchCamera}
              >
                <FlipHorizontal className="w-5 h-5 text-white" />
              </Button>
            )}
            <Button 
              size="icon" 
              variant="secondary" 
              className={`rounded-full ${torchEnabled ? 'bg-yellow-500' : 'bg-black/50 hover:bg-black/70'}`}
              onClick={toggleTorch}
            >
              <Flashlight className="w-5 h-5 text-white" />
            </Button>
          </div>
        </div>

        {/* Last scanned display */}
        {lastScanned && (
          <div className="px-4 py-3 bg-green-50 dark:bg-green-900/30 border-t border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Scanned:</p>
                <p className="font-mono text-lg">{lastScanned}</p>
              </div>
            </div>
          </div>
        )}

        {/* Continuous mode: scanned items list */}
        {continuous && scannedItems.length > 0 && (
          <div className="px-4 py-3 border-t max-h-40 overflow-auto">
            <p className="text-sm font-medium mb-2">Scanned Items ({scannedItems.length})</p>
            <div className="space-y-1">
              {scannedItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm bg-accent/50 rounded px-2 py-1">
                  <span className="font-mono">{item.code}</span>
                  <span className="text-xs text-muted-foreground">×{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          {continuous && scannedItems.length > 0 && (
            <Button className="flex-1" onClick={() => {
              onScan(scannedItems, { bulk: true });
              handleClose();
            }}>
              <Check className="w-4 h-4 mr-2" />
              Done ({scannedItems.length})
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// CSS for scan line animation (add to index.css)
// @keyframes scan-line { 0%, 100% { top: 10%; } 50% { top: 85%; } }
// .animate-scan-line { animation: scan-line 2s ease-in-out infinite; }
