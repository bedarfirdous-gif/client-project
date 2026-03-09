import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  Camera, Upload, Shirt, Sparkles, RotateCcw, Download, Share2,
  ChevronLeft, ChevronRight, User, ShoppingBag, X, Loader2,
  Image as ImageIcon, Check, ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export default function VirtualTrialRoomPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();

  // Keep the File object nullable (not used directly as an <img loading="lazy" src>), but ensure
  // any image *src* state uses stable empty-string defaults to avoid null -> value flashes.
  const [userPhoto, setUserPhoto] = useState(null);

  // IMPORTANT: must never be null when bound to <img loading="lazy" src>; use '' as the empty state.
  const [userPhotoPreview, setUserPhotoPreview] = useState('');

  // Keep as null (no selection) to preserve existing selection logic.
  const [selectedGarment, setSelectedGarment] = useState(null);

  // IMPORTANT: avoid null initial state for result images (prevents src flashing);
  // track readiness separately with an explicit loaded flag.
  const [tryOnResult, setTryOnResult] = useState('');
  const [isTryOnLoaded, setIsTryOnLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showResult, setShowResult] = useState(false);
  const fileInputRef = useRef(null);
  const webcamRef = useRef(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);

  // Fetch catalogue items
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      // Use the virtual try-on products endpoint that returns items with images
      const data = await api('/api/virtual-tryon/products?limit=50');
      if (data.success && data.products) {
        setItems(data.products);
      } else {
        // Fallback to regular items endpoint
        const itemsData = await api('/api/items?active=true');
        setItems(itemsData.filter(item => (item.images && item.images.length > 0) || item.image_url));
      }
    } catch (err) {
      console.error('Failed to load items:', err);
      toast.error('Failed to load catalogue');
    } finally {
      setLoadingItems(false);
    }
  };

  // Handle user photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setUserPhotoPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    setUserPhoto(file);
    setTryOnResult(null);
    toast.success('Photo uploaded! Now select a garment to try on.');
  };

  // Start webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      setWebcamStream(stream);
      setShowWebcam(true);
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error('Could not access camera. Please check permissions.');
    }
  };

  // Capture from webcam
  const captureFromWebcam = () => {
    if (!webcamRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = webcamRef.current.videoWidth;
    canvas.height = webcamRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(webcamRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], 'webcam-photo.jpg', { type: 'image/jpeg' });
      setUserPhoto(file);
      setUserPhotoPreview(canvas.toDataURL('image/jpeg'));
      stopWebcam();
      toast.success('Photo captured! Now select a garment to try on.');
    }, 'image/jpeg', 0.9);
  };

  // Stop webcam
  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    setShowWebcam(false);
  };

  // Virtual Try-On with AI (using OpenAI GPT Image 1)
  const handleTryOn = async () => {
    if (!userPhotoPreview || !selectedGarment) {
      toast.error('Please capture your photo and select a garment');
      return;
    }

    setLoading(true);
    toast.info('AI is generating your virtual try-on... This may take up to 60 seconds.');

    try {
      // Extract base64 from data URL
      const personImageBase64 = userPhotoPreview.split(',')[1];
      const garmentImageUrl = selectedGarment.images?.[0] || selectedGarment.image_url;
      
      // Determine category based on garment type
      let category = 'upper_body';
      const garmentCategory = (selectedGarment.category || '').toLowerCase();
      if (garmentCategory.includes('pant') || garmentCategory.includes('trouser') || garmentCategory.includes('jean') || garmentCategory.includes('skirt')) {
        category = 'lower_body';
      } else if (garmentCategory.includes('dress') || garmentCategory.includes('suit') || garmentCategory.includes('outfit')) {
        category = 'full_body';
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/virtual-tryon/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          person_image_base64: personImageBase64,
          garment_image_url: garmentImageUrl,
          garment_name: selectedGarment.name,
          category: category
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.result_image_base64) {
          // Convert base64 back to data URL for display
          setTryOnResult(`data:image/png;base64,${data.result_image_base64}`);
          setShowResult(true);
          toast.success(`Virtual try-on complete! (${data.processing_time}s)`);
        } else {
          toast.error(data.message || 'Try-on failed. Please try again.');
        }
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.detail || 'Try-on failed. Please try again.');
      }
    } catch (err) {
      console.error('Try-on error:', err);
      toast.error('Failed to process try-on. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset everything
  const handleReset = () => {
    setUserPhoto(null);
    setUserPhotoPreview(null);
    setSelectedGarment(null);
    setTryOnResult(null);
    setShowResult(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Download result
  const handleDownload = () => {
    if (!tryOnResult) return;
    const link = document.createElement('a');
    link.href = tryOnResult.startsWith('data:') ? tryOnResult : `${process.env.REACT_APP_BACKEND_URL}${tryOnResult}`;
    link.download = `virtual-tryon-${Date.now()}.png`;
    link.click();
    toast.success('Image downloaded!');
  };

  // Filter items by category
  const filteredItems = selectedCategory === 'all' 
    ? items 
    : items.filter(item => item.category?.toLowerCase().includes(selectedCategory));

  const categories = ['all', ...new Set(items.map(item => item.category).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-purple-100 dark:border-purple-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Shirt className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Virtual Trial Room
                </h1>
                <p className="text-sm text-muted-foreground">Try before you buy</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Start Over
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Steps Progress */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${userPhotoPreview ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${userPhotoPreview ? 'bg-green-500 text-white' : 'bg-purple-500 text-white'}`}>
              {userPhotoPreview ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <span className="font-medium">Upload Photo</span>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${selectedGarment ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selectedGarment ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
              {selectedGarment ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <span className="font-medium">Select Garment</span>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${tryOnResult ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${tryOnResult ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
              {tryOnResult ? <Check className="w-4 h-4" /> : '3'}
            </div>
            <span className="font-medium">Try On</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - User Photo */}
          <div className="lg:col-span-1">
            <Card className="border-2 border-purple-200 dark:border-purple-800 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" />
                  Your Photo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {!userPhotoPreview ? (
                  <div className="space-y-4">
                    <div 
                      className="border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-2xl p-8 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <Upload className="w-12 h-12 mx-auto text-purple-400 mb-3" />
                      <p className="font-medium text-purple-700 dark:text-purple-300">Upload Your Photo</p>
                      <p className="text-sm text-muted-foreground mt-1">Full body or upper body</p>
                    </div>
                    
                    <div className="text-center text-muted-foreground">or</div>
                    
                    <Button 
                      variant="outline" 
                      className="w-full gap-2 border-purple-300 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-900/20"
                      onClick={startWebcam}
                    >
                      <Camera className="w-4 h-4" />
                      Take a Photo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-gray-100 dark:bg-gray-800">
                      <img loading="lazy" 
                        src={userPhotoPreview} 
                        alt="Your photo" 
                        className="w-full h-full object-cover"
                      />
                      <button 
                        onClick={() => {
                          setUserPhoto(null);
                          setUserPhotoPreview(null);
                          setTryOnResult(null);
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <Badge className="w-full justify-center bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Check className="w-4 h-4 mr-1" />
                      Photo Ready
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Try On Button */}
            {userPhotoPreview && selectedGarment && (
              <Button
                className="w-full mt-4 h-14 text-lg gap-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
                onClick={handleTryOn}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Try-On...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Try On Now
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Center Panel - Garment Selection */}
          <div className="lg:col-span-2">
            <Card className="border-2 border-pink-200 dark:border-pink-800 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-pink-500/10 to-purple-500/10">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shirt className="w-5 h-5 text-pink-600" />
                    Select Garment
                  </div>
                  {selectedGarment && (
                    <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">
                      {selectedGarment.name} selected
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {/* Category Filter */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  {categories.slice(0, 6).map(cat => (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(cat)}
                      className="capitalize whitespace-nowrap"
                    >
                      {cat}
                    </Button>
                  ))}
                </div>

                {/* Garments Grid */}
                {loadingItems ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shirt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No garments with images available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2">
                    {filteredItems.map(item => {
                      // Get image URL from either new or old format
                      const imageUrl = item.image_url || (item.images && item.images[0]);
                      const displayPrice = item.price || item.selling_price;
                      
                      return (
                        <div
                          key={item.id}
                          className={`relative rounded-xl overflow-hidden cursor-pointer transition-all transform hover:scale-105 ${
                            selectedGarment?.id === item.id 
                              ? 'ring-4 ring-pink-500 shadow-lg' 
                              : 'hover:shadow-md'
                          }`}
                          onClick={() => {
                            setSelectedGarment({...item, image_url: imageUrl});
                            setTryOnResult(null);
                            toast.success(`Selected: ${item.name}`);
                          }}
                        >
                          <div className="aspect-square bg-gray-100 dark:bg-gray-800">
                            <img loading="lazy"
                              src={imageUrl?.startsWith('http') ? imageUrl : `${process.env.REACT_APP_BACKEND_URL}${imageUrl}`}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = 'https://via.placeholder.com/200?text=No+Image';
                              }}
                            />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                            <p className="text-white text-sm font-medium truncate">{item.name}</p>
                            {displayPrice && <p className="text-white/80 text-xs">{currencySymbol}{displayPrice}</p>}
                          </div>
                          {selectedGarment?.id === item.id && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Webcam Dialog */}
      <Dialog open={showWebcam} onOpenChange={(open) => !open && stopWebcam()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Take a Photo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
              <video
                ref={webcamRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={stopWebcam} className="flex-1">
                Cancel
              </Button>
              <Button onClick={captureFromWebcam} className="flex-1 bg-purple-600 hover:bg-purple-700">
                <Camera className="w-4 h-4 mr-2" />
                Capture
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Your Virtual Try-On
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {tryOnResult && (
              <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img loading="lazy"
                  src={tryOnResult.startsWith('data:') ? tryOnResult : `${process.env.REACT_APP_BACKEND_URL}${tryOnResult}`}
                  alt="Virtual Try-On Result"
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleDownload} className="flex-1 gap-2">
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button 
                className="flex-1 gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                onClick={() => {
                  // Add to cart logic
                  toast.success('Added to cart! Proceeding to checkout.');
                  setShowResult(false);
                }}
              >
                <ShoppingBag className="w-4 h-4" />
                Add to Cart
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
