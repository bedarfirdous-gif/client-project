import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import {
  Camera, Upload, Ruler, User, ShirtIcon, Scan, RefreshCw, Save,
  ChevronRight, Check, X, Download, Share2, ShoppingCart, Scissors,
  ArrowRight, ZoomIn, ZoomOut, RotateCcw, Loader2, Info, Settings,
  Shirt, CircleDot, Move, Target, AlertCircle, HelpCircle, Layers
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Slider } from '../components/ui/slider';

// Size Guide Component
const SizeGuideDialog = ({ open, onClose, category }) => {
  const measurementGuides = {
    tops: [
      { name: 'Chest', description: 'Measure around the fullest part of your chest, keeping the tape horizontal', icon: '📏' },
      { name: 'Shoulder', description: 'Measure from the edge of one shoulder to the other across your back', icon: '📐' },
      { name: 'Arm Length', description: 'Measure from shoulder point to wrist with arm slightly bent', icon: '💪' },
      { name: 'Neck', description: 'Measure around the base of your neck, adding 1cm for comfort', icon: '👔' }
    ],
    bottoms: [
      { name: 'Waist', description: 'Measure around your natural waistline, at the narrowest point', icon: '📏' },
      { name: 'Hip', description: 'Measure around the fullest part of your hips', icon: '📐' },
      { name: 'Inseam', description: 'Measure from the crotch to the bottom of the ankle', icon: '📏' },
      { name: 'Thigh', description: 'Measure around the fullest part of your thigh', icon: '💪' }
    ],
    dresses: [
      { name: 'Bust', description: 'Measure around the fullest part of your bust', icon: '📏' },
      { name: 'Waist', description: 'Measure at your natural waistline', icon: '📐' },
      { name: 'Hip', description: 'Measure around the fullest part of your hips', icon: '📏' },
      { name: 'Length', description: 'Measure from shoulder to desired hem length', icon: '📐' }
    ],
    outerwear: [
      { name: 'Chest', description: 'Measure over your shirt for layering room', icon: '📏' },
      { name: 'Shoulder', description: 'Measure across the back from shoulder to shoulder', icon: '📐' },
      { name: 'Sleeve', description: 'Measure from shoulder to wrist', icon: '💪' },
      { name: 'Length', description: 'Measure from collar to desired hem', icon: '📏' }
    ],
    ethnic: [
      { name: 'Chest', description: 'Measure around fullest part of chest', icon: '📏' },
      { name: 'Waist', description: 'Measure at natural waistline', icon: '📐' },
      { name: 'Kurta Length', description: 'Measure from shoulder to knee (or desired length)', icon: '📏' },
      { name: 'Sleeve', description: 'Measure from shoulder to wrist', icon: '💪' }
    ]
  };

  const tips = [
    'Stand straight and relaxed while measuring',
    'Use a soft measuring tape for accuracy',
    'Measure over light clothing or undergarments',
    'Keep the tape snug but not tight',
    'Take measurements twice to confirm accuracy'
  ];

  const currentGuide = measurementGuides[category] || measurementGuides.tops;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-purple-600" />
            Size Guide - {category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Tops'}
          </DialogTitle>
          <DialogDescription>
            Follow these instructions for accurate measurements
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Visual Guide */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <svg viewBox="0 0 200 300" className="w-40 h-60">
                  {/* Simple body outline */}
                  <ellipse cx="100" cy="30" rx="25" ry="30" fill="none" stroke="#9333ea" strokeWidth="2"/>
                  <line x1="100" y1="60" x2="100" y2="150" stroke="#9333ea" strokeWidth="2"/>
                  <line x1="100" y1="80" x2="50" y2="130" stroke="#9333ea" strokeWidth="2"/>
                  <line x1="100" y1="80" x2="150" y2="130" stroke="#9333ea" strokeWidth="2"/>
                  <line x1="100" y1="150" x2="70" y2="280" stroke="#9333ea" strokeWidth="2"/>
                  <line x1="100" y1="150" x2="130" y2="280" stroke="#9333ea" strokeWidth="2"/>
                  
                  {/* Measurement lines */}
                  {category === 'tops' || category === 'dresses' || category === 'outerwear' || category === 'ethnic' ? (
                    <>
                      {/* Chest line */}
                      <line x1="60" y1="90" x2="140" y2="90" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5,5"/>
                      <text x="145" y="95" fill="#f59e0b" fontSize="10">Chest</text>
                      {/* Shoulder line */}
                      <line x1="50" y1="75" x2="150" y2="75" stroke="#10b981" strokeWidth="2" strokeDasharray="5,5"/>
                      <text x="155" y="80" fill="#10b981" fontSize="10">Shoulder</text>
                    </>
                  ) : null}
                  
                  {category === 'bottoms' || category === 'dresses' ? (
                    <>
                      {/* Waist line */}
                      <line x1="75" y1="130" x2="125" y2="130" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5,5"/>
                      <text x="130" y="135" fill="#3b82f6" fontSize="10">Waist</text>
                      {/* Hip line */}
                      <line x1="65" y1="160" x2="135" y2="160" stroke="#ec4899" strokeWidth="2" strokeDasharray="5,5"/>
                      <text x="140" y="165" fill="#ec4899" fontSize="10">Hip</text>
                    </>
                  ) : null}
                </svg>
              </div>
            </div>
          </div>

          {/* Measurement Instructions */}
          <div>
            <h3 className="font-semibold text-lg mb-3">How to Measure</h3>
            <div className="grid gap-3">
              {currentGuide.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-2xl">{item.icon}</div>
                  <div>
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Pro Tips
            </h3>
            <ul className="space-y-1">
              {tips.map((tip, idx) => (
                <li key={idx} className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <Check className="w-3 h-3 flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Size Charts Preview */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Size Chart Reference</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-purple-100 dark:bg-purple-900/30">
                  <tr>
                    <th className="px-3 py-2 text-left">Size</th>
                    <th className="px-3 py-2 text-left">Chest (cm)</th>
                    <th className="px-3 py-2 text-left">Waist (cm)</th>
                    <th className="px-3 py-2 text-left">Hip (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {category === 'bottoms' ? (
                    <>
                      <tr className="border-t"><td className="px-3 py-2 font-medium">28</td><td>-</td><td>71-74</td><td>86-89</td></tr>
                      <tr className="border-t bg-gray-50 dark:bg-gray-800/30"><td className="px-3 py-2 font-medium">30</td><td>-</td><td>76-79</td><td>91-94</td></tr>
                      <tr className="border-t"><td className="px-3 py-2 font-medium">32</td><td>-</td><td>81-84</td><td>97-99</td></tr>
                      <tr className="border-t bg-gray-50 dark:bg-gray-800/30"><td className="px-3 py-2 font-medium">34</td><td>-</td><td>86-89</td><td>102-104</td></tr>
                      <tr className="border-t"><td className="px-3 py-2 font-medium">36</td><td>-</td><td>91-94</td><td>107-109</td></tr>
                    </>
                  ) : (
                    <>
                      <tr className="border-t"><td className="px-3 py-2 font-medium">S</td><td>81-89</td><td>66-71</td><td>89-94</td></tr>
                      <tr className="border-t bg-gray-50 dark:bg-gray-800/30"><td className="px-3 py-2 font-medium">M</td><td>89-97</td><td>71-76</td><td>94-99</td></tr>
                      <tr className="border-t"><td className="px-3 py-2 font-medium">L</td><td>97-107</td><td>76-81</td><td>99-104</td></tr>
                      <tr className="border-t bg-gray-50 dark:bg-gray-800/30"><td className="px-3 py-2 font-medium">XL</td><td>107-117</td><td>81-86</td><td>104-109</td></tr>
                      <tr className="border-t"><td className="px-3 py-2 font-medium">XXL</td><td>117-127</td><td>86-91</td><td>109-114</td></tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={() => onClose(false)} className="bg-purple-600 hover:bg-purple-700">
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Body landmark indices for MediaPipe Pose
const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
};

// Category-specific size charts
const CATEGORY_SIZE_CHARTS = {
  tops: {
    label: 'Tops (T-Shirts, Shirts, Polos)',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    measurements: {
      XS: { chest: [76, 81], shoulder: [38, 40] },
      S: { chest: [81, 89], shoulder: [40, 42] },
      M: { chest: [89, 97], shoulder: [42, 44] },
      L: { chest: [97, 107], shoulder: [44, 46] },
      XL: { chest: [107, 117], shoulder: [46, 48] },
      XXL: { chest: [117, 127], shoulder: [48, 50] },
      XXXL: { chest: [127, 137], shoulder: [50, 52] }
    }
  },
  bottoms: {
    label: 'Bottoms (Jeans, Trousers, Shorts)',
    sizes: ['28', '30', '32', '34', '36', '38', '40', '42'],
    measurements: {
      '28': { waist: [71, 74], hip: [86, 89] },
      '30': { waist: [76, 79], hip: [91, 94] },
      '32': { waist: [81, 84], hip: [97, 99] },
      '34': { waist: [86, 89], hip: [102, 104] },
      '36': { waist: [91, 94], hip: [107, 109] },
      '38': { waist: [97, 99], hip: [112, 114] },
      '40': { waist: [102, 104], hip: [117, 119] },
      '42': { waist: [107, 109], hip: [122, 124] }
    }
  },
  dresses: {
    label: 'Dresses',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    measurements: {
      XS: { chest: [76, 81], waist: [61, 66], hip: [84, 89] },
      S: { chest: [81, 86], waist: [66, 71], hip: [89, 94] },
      M: { chest: [86, 91], waist: [71, 76], hip: [94, 99] },
      L: { chest: [91, 97], waist: [76, 81], hip: [99, 104] },
      XL: { chest: [97, 102], waist: [81, 86], hip: [104, 109] },
      XXL: { chest: [102, 107], waist: [86, 91], hip: [109, 114] }
    }
  },
  outerwear: {
    label: 'Outerwear (Blazers, Jackets)',
    sizes: ['36', '38', '40', '42', '44', '46', '48'],
    measurements: {
      '36': { chest: [91, 94], shoulder: [42, 43] },
      '38': { chest: [94, 97], shoulder: [43, 44] },
      '40': { chest: [97, 102], shoulder: [44, 45] },
      '42': { chest: [102, 107], shoulder: [45, 46] },
      '44': { chest: [107, 112], shoulder: [46, 47] },
      '46': { chest: [112, 117], shoulder: [47, 48] },
      '48': { chest: [117, 122], shoulder: [48, 49] }
    }
  },
  ethnic: {
    label: 'Ethnic Wear (Kurta, Sherwani)',
    sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    measurements: {
      S: { chest: [86, 91] },
      M: { chest: [91, 97] },
      L: { chest: [97, 102] },
      XL: { chest: [102, 107] },
      XXL: { chest: [107, 112] },
      XXXL: { chest: [112, 117] }
    }
  }
};

// Standard clothing sizes (legacy - for backwards compatibility)
const SIZE_CHART = CATEGORY_SIZE_CHARTS.tops.measurements;

// Calculate distance between two points
const calculateDistance = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Determine size for a specific category
const determineCategorySize = (measurements, category = 'tops') => {
  const chart = CATEGORY_SIZE_CHARTS[category] || CATEGORY_SIZE_CHARTS.tops;
  let bestSize = chart?.sizes?.[Math.floor((chart?.sizes?.length || 0) / 2)] || 'M'; // Default to middle or 'M'
  let bestScore = Infinity;
  let fitAnalysis = {};
  
  // Guard against undefined measurements
  if (!chart?.measurements) {
    return { size: bestSize, fitAnalysis: {} };
  }
  
  for (const [size, ranges] of Object.entries(chart.measurements)) {
    let score = 0;
    const fits = {};
    
    if (ranges.chest && measurements.chest) {
      const [min, max] = ranges.chest;
      if (measurements.chest >= min && measurements.chest <= max) {
        fits.chest = 'perfect';
      } else if (measurements.chest < min) {
        fits.chest = 'loose';
        score += min - measurements.chest;
      } else {
        fits.chest = 'tight';
        score += measurements.chest - max;
      }
    }
    
    if (ranges.waist && measurements.waist) {
      const [min, max] = ranges.waist;
      if (measurements.waist >= min && measurements.waist <= max) {
        fits.waist = 'perfect';
      } else if (measurements.waist < min) {
        fits.waist = 'loose';
        score += min - measurements.waist;
      } else {
        fits.waist = 'tight';
        score += measurements.waist - max;
      }
    }
    
    if (ranges.hip && measurements.hip) {
      const [min, max] = ranges.hip;
      if (measurements.hip >= min && measurements.hip <= max) {
        fits.hip = 'perfect';
      } else if (measurements.hip < min) {
        fits.hip = 'loose';
        score += min - measurements.hip;
      } else {
        fits.hip = 'tight';
        score += measurements.hip - max;
      }
    }
    
    if (score < bestScore) {
      bestScore = score;
      bestSize = size;
      fitAnalysis = fits;
    }
  }
  
  return {
    recommendedSize: bestSize,
    fitAnalysis,
    confidence: Math.max(50, 100 - bestScore),
    category,
    availableSizes: chart.sizes
  };
};

// Calculate body measurements from pose landmarks
const calculateMeasurements = (landmarks, heightInCm, imageHeight) => {
  if (!landmarks || landmarks.length < 33) return null;
  
  // Calculate pixel-to-cm ratio using height reference
  // Distance from top of head (approximate from nose) to ankle
  const headToAnkle = calculateDistance(
    landmarks[POSE_LANDMARKS.NOSE],
    landmarks[POSE_LANDMARKS.LEFT_ANKLE]
  ) * imageHeight;
  
  const pixelToCm = heightInCm / (headToAnkle * 1.1); // 1.1 factor for head above nose
  
  // Shoulder width
  const shoulderWidth = calculateDistance(
    landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
  ) * imageHeight * pixelToCm;
  
  // Chest (approximate - shoulder width * 1.1)
  const chest = shoulderWidth * Math.PI * 0.35; // Circumference approximation
  
  // Hip width
  const hipWidth = calculateDistance(
    landmarks[POSE_LANDMARKS.LEFT_HIP],
    landmarks[POSE_LANDMARKS.RIGHT_HIP]
  ) * imageHeight * pixelToCm;
  
  // Hip circumference
  const hip = hipWidth * Math.PI * 0.4;
  
  // Waist (between chest and hip)
  const waist = (chest + hip) / 2 * 0.85;
  
  // Arm length (shoulder to wrist)
  const leftArmLength = (
    calculateDistance(landmarks[POSE_LANDMARKS.LEFT_SHOULDER], landmarks[POSE_LANDMARKS.LEFT_ELBOW]) +
    calculateDistance(landmarks[POSE_LANDMARKS.LEFT_ELBOW], landmarks[POSE_LANDMARKS.LEFT_WRIST])
  ) * imageHeight * pixelToCm;
  
  const rightArmLength = (
    calculateDistance(landmarks[POSE_LANDMARKS.RIGHT_SHOULDER], landmarks[POSE_LANDMARKS.RIGHT_ELBOW]) +
    calculateDistance(landmarks[POSE_LANDMARKS.RIGHT_ELBOW], landmarks[POSE_LANDMARKS.RIGHT_WRIST])
  ) * imageHeight * pixelToCm;
  
  const armLength = (leftArmLength + rightArmLength) / 2;
  
  // Inseam (hip to ankle)
  const leftInseam = (
    calculateDistance(landmarks[POSE_LANDMARKS.LEFT_HIP], landmarks[POSE_LANDMARKS.LEFT_KNEE]) +
    calculateDistance(landmarks[POSE_LANDMARKS.LEFT_KNEE], landmarks[POSE_LANDMARKS.LEFT_ANKLE])
  ) * imageHeight * pixelToCm;
  
  const rightInseam = (
    calculateDistance(landmarks[POSE_LANDMARKS.RIGHT_HIP], landmarks[POSE_LANDMARKS.RIGHT_KNEE]) +
    calculateDistance(landmarks[POSE_LANDMARKS.RIGHT_KNEE], landmarks[POSE_LANDMARKS.RIGHT_ANKLE])
  ) * imageHeight * pixelToCm;
  
  const inseam = (leftInseam + rightInseam) / 2;
  
  // Torso length (shoulder to hip)
  const torsoLength = calculateDistance(
    { x: (landmarks[POSE_LANDMARKS.LEFT_SHOULDER].x + landmarks[POSE_LANDMARKS.RIGHT_SHOULDER].x) / 2,
      y: (landmarks[POSE_LANDMARKS.LEFT_SHOULDER].y + landmarks[POSE_LANDMARKS.RIGHT_SHOULDER].y) / 2 },
    { x: (landmarks[POSE_LANDMARKS.LEFT_HIP].x + landmarks[POSE_LANDMARKS.RIGHT_HIP].x) / 2,
      y: (landmarks[POSE_LANDMARKS.LEFT_HIP].y + landmarks[POSE_LANDMARKS.RIGHT_HIP].y) / 2 }
  ) * imageHeight * pixelToCm;
  
  // Neck (approximate)
  const neck = shoulderWidth * 0.4;
  
  return {
    height: heightInCm,
    shoulder: Math.round(shoulderWidth),
    chest: Math.round(chest),
    waist: Math.round(waist),
    hip: Math.round(hip),
    armLength: Math.round(armLength),
    inseam: Math.round(inseam),
    torsoLength: Math.round(torsoLength),
    neck: Math.round(neck)
  };
};

// Determine clothing size from measurements (uses determineCategorySize for all categories)
const determineSizeRecommendation = (measurements, category = 'tops') => {
  if (!measurements) return null;
  return determineCategorySize(measurements, category);
};

export default function VirtualTryOnPage() {
  const { api, user } = useAuth();
  const { currencySymbol } = useCurrency();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // State
  const [activeTab, setActiveTab] = useState('measure');
  const [options, setOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  // Avoid null initial state to prevent UI flashing between "no data" and "data" branches.
  // Use stable defaults + explicit readiness flags.
  const [capturedImage, setCapturedImage] = useState('');
  const [uploadedImage, setUploadedImage] = useState('');
  const [hasCapturedImage, setHasCapturedImage] = useState(false);
  const [hasUploadedImage, setHasUploadedImage] = useState(false);

  const [poseDetected, setPoseDetected] = useState(false);

  // Landmarks default to an empty object; consumers should use hasLandmarks/poseDetected for rendering.
  const [landmarks, setLandmarks] = useState({});
  const [hasLandmarks, setHasLandmarks] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('tops');
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  
  // Measurement state
  const [userHeight, setUserHeight] = useState(170);

  // FIX: Avoid null initial state that can cause a first-render "empty" UI and then a sudden repaint
  // when async data arrives. Use stable empty shapes and explicit loaded flags to control rendering.
  const [measurements, setMeasurements] = useState({});
  const [isMeasurementsLoaded, setIsMeasurementsLoaded] = useState(false);

  const [sizeRecommendation, setSizeRecommendation] = useState({});
  const [isSizeRecommendationLoaded, setIsSizeRecommendationLoaded] = useState(false);

  const [savedMeasurements, setSavedMeasurements] = useState([]);
  
  // Try-on state
  // NOTE: Keep selectedClothing as null (meaning "nothing selected") since it's user-driven,
  // but ensure async results don't start as null to prevent conditional rendering flicker.
  const [selectedClothing, setSelectedClothing] = useState(null);
  const [clothingItems, setClothingItems] = useState([]);

  const [tryOnResult, setTryOnResult] = useState({});
  const [isTryOnResultLoaded, setIsTryOnResultLoaded] = useState(false);
  
  // Custom measurements
  const [customMeasurements, setCustomMeasurements] = useState({
    chest: '',
    waist: '',
    hip: '',
    shoulder: '',
    armLength: '',
    inseam: '',
    neck: ''
  });
  
  // Fabric selection for try-on
  const [fabrics, setFabrics] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState(null);

  // Load clothing items from catalogue
  useEffect(() => {
    const fetchClothingItems = async () => {
      try {
        // Fetch all items - they can be filtered for clothing based on name/SKU patterns
        const data = await api('/api/items?limit=50');
        // Filter for clothing-related items based on SKU/name patterns
        const clothingKeywords = ['shirt', 'jeans', 'dress', 'kurta', 'blazer', 'jacket', 'polo', 'pants', 'shorts', 'trousers', 'tshirt', 't-shirt', 'top'];
        const clothing = (data.items || data || []).filter(item => {
          const nameMatch = clothingKeywords.some(kw => item.name?.toLowerCase().includes(kw));
          const skuMatch = clothingKeywords.some(kw => item.sku?.toLowerCase().includes(kw));
          return nameMatch || skuMatch;
        });
        setClothingItems(clothing);
      } catch (err) {
        console.error('Failed to load clothing items:', err);
      }
    };
    fetchClothingItems();
    
    // Load fabrics for try-on
    const fetchFabrics = async () => {
      try {
        const data = await api('/api/fabrics?limit=20');
        setFabrics(data.fabrics || []);
      } catch (err) {
        console.error('Failed to load fabrics:', err);
      }
    };
    fetchFabrics();
    
    // Load saved measurements
    const fetchSavedMeasurements = async () => {
      try {
        const data = await api('/api/body-measurements');
        setSavedMeasurements(data.measurements || []);
      } catch (err) {
        console.error('Failed to load saved measurements:', err);
      }
    };
    fetchSavedMeasurements();
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      toast.error('Failed to access camera');
      console.error(err);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  // Capture image from camera
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg');
    setCapturedImage(imageData);
    setUploadedImage(null);
    stopCamera();
    
    // Process image for pose detection
    processImage(imageData, canvas.height);
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target.result;
      setUploadedImage(imageData);
      setCapturedImage(null);
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        processImage(imageData, img.height);
      };
      img.src = imageData;
    };
    reader.readAsDataURL(file);
  };

  // Process image for pose detection using MediaPipe
  const processImage = async (imageData, imageHeight) => {
    setIsLoading(true);
    setPoseDetected(false);
    
    try {
      // Import MediaPipe dynamically
      const { Pose } = await import('@mediapipe/pose');
      
      const pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });
      
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      pose.onResults((results) => {
        if (results.poseLandmarks && results.poseLandmarks.length > 0) {
          setLandmarks(results.poseLandmarks);
          setPoseDetected(true);
          
          // Calculate measurements
          const calculatedMeasurements = calculateMeasurements(
            results.poseLandmarks,
            userHeight,
            imageHeight
          );
          
          if (calculatedMeasurements) {
            setMeasurements(calculatedMeasurements);
            const sizeRec = determineSizeRecommendation(calculatedMeasurements, selectedCategory);
            setSizeRecommendation(sizeRec);
            toast.success('Body measurements calculated!');
          }
          
          // Draw pose on canvas
          drawPoseOnCanvas(results.poseLandmarks, imageHeight);
        } else {
          toast.error('Could not detect body pose. Please ensure full body is visible.');
        }
        setIsLoading(false);
      });
      
      // Create image element and process
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        await pose.send({ image: img });
      };
      img.src = imageData;
      
    } catch (err) {
      console.error('Pose detection error:', err);
      toast.error('Failed to process image');
      setIsLoading(false);
    }
  };

  // Draw pose landmarks on canvas
  const drawPoseOnCanvas = (poseLandmarks, imageHeight) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Draw connections
    const connections = [
      [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
      [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
      [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
      [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
      [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
      [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
      [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
      [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
      [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
      [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
      [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
      [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE]
    ];
    
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    
    connections.forEach(([start, end]) => {
      const startPoint = poseLandmarks[start];
      const endPoint = poseLandmarks[end];
      
      ctx.beginPath();
      ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
      ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
      ctx.stroke();
    });
    
    // Draw landmarks
    ctx.fillStyle = '#FF0000';
    poseLandmarks.forEach((landmark, index) => {
      if (index <= 32) {
        ctx.beginPath();
        ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  // Save measurements
  const saveMeasurements = async () => {
    if (!measurements) {
      toast.error('No measurements to save');
      return;
    }
    
    try {
      await api('/api/body-measurements', {
        method: 'POST',
        body: JSON.stringify({
          ...measurements,
          source: 'ai_detection',
          created_at: new Date().toISOString()
        })
      });
      toast.success('Measurements saved!');
      
      // Refresh saved measurements
      const data = await api('/api/body-measurements');
      setSavedMeasurements(data.measurements || []);
    } catch (err) {
      toast.error('Failed to save measurements');
    }
  };

  // Save custom measurements
  const saveCustomMeasurements = async () => {
    const custom = {
      chest: parseInt(customMeasurements.chest) || 0,
      waist: parseInt(customMeasurements.waist) || 0,
      hip: parseInt(customMeasurements.hip) || 0,
      shoulder: parseInt(customMeasurements.shoulder) || 0,
      armLength: parseInt(customMeasurements.armLength) || 0,
      inseam: parseInt(customMeasurements.inseam) || 0,
      neck: parseInt(customMeasurements.neck) || 0,
      height: userHeight
    };
    
    if (custom.chest === 0 && custom.waist === 0 && custom.hip === 0) {
      toast.error('Please enter at least chest, waist, and hip measurements');
      return;
    }
    
    try {
      await api('/api/body-measurements', {
        method: 'POST',
        body: JSON.stringify({
          ...custom,
          source: 'manual',
          created_at: new Date().toISOString()
        })
      });
      toast.success('Custom measurements saved!');
      setMeasurements(custom);
      setSizeRecommendation(determineSizeRecommendation(custom, selectedCategory));
    } catch (err) {
      toast.error('Failed to save measurements');
    }
  };

  // Update size recommendation when category changes
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    if (measurements) {
      setSizeRecommendation(determineSizeRecommendation(measurements, category));
    }
  };

  // Virtual try-on
  const performTryOn = async () => {
    if (!selectedClothing || !measurements) {
      toast.error('Please select clothing and have measurements ready');
      return;
    }
    
    // Get category from selected clothing
    const clothingCategory = selectedClothing.category || 'tops';
    const categorySize = determineSizeRecommendation(measurements, clothingCategory);
    
    setIsLoading(true);
    try {
      const result = await api('/api/virtual-tryon/simulate', {
        method: 'POST',
        body: JSON.stringify({
          clothing_id: selectedClothing.id,
          measurements: measurements,
          size_recommendation: categorySize
        })
      });
      
      setTryOnResult(result);
      toast.success('Virtual try-on complete!');
    } catch (err) {
      toast.error('Try-on simulation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Order/Purchase flow
  const proceedToOrder = async (orderType = 'purchase') => {
    if (!selectedClothing || !sizeRecommendation) {
      toast.error('Please complete measurements and select clothing first');
      return;
    }
    
    try {
      const orderData = {
        item_id: selectedClothing.id,
        size: sizeRecommendation.recommendedSize,
        measurements: measurements,
        order_type: orderType, // 'purchase', 'stitching', 'custom'
        notes: orderType === 'stitching' ? 'Custom stitching required' : ''
      };
      
      // Add to cart or create order
      await api('/api/cart/add', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
      
      toast.success(`Added to cart for ${orderType === 'stitching' ? 'custom stitching' : 'purchase'}!`);
    } catch (err) {
      toast.error('Failed to add to cart');
    }
  };

  return (
    <div className="space-y-6" data-testid="virtual-tryon-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shirt className="w-7 h-7 text-purple-600" />
            Virtual Try-On & Body Measurement
          </h1>
          <p className="text-gray-500 mt-1">AI-powered body scanning for perfect fit</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 dark:bg-gray-800 p-1">
          <TabsTrigger value="measure" className="gap-2">
            <Ruler className="w-4 h-4" />
            Body Measurement
          </TabsTrigger>
          <TabsTrigger value="tryon" className="gap-2">
            <Shirt className="w-4 h-4" />
            Virtual Try-On
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-2">
            <Save className="w-4 h-4" />
            Saved Profiles
          </TabsTrigger>
        </TabsList>

        {/* Measurement Tab */}
        <TabsContent value="measure" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Image Capture Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-600" />
                  Capture Your Body
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Height Input */}
                <div>
                  <Label>Your Height (cm)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      value={userHeight}
                      onChange={(e) => setUserHeight(parseInt(e.target.value) || 170)}
                      className="w-32"
                      data-testid="height-input"
                    />
                    <span className="text-gray-500 self-center">cm ({Math.round(userHeight / 2.54)}")</span>
                  </div>
                </div>

                {/* Camera/Upload Section */}
                <div className="aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden relative">
                  {cameraActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : capturedImage || uploadedImage ? (
                    <div className="relative w-full h-full">
                      <img loading="lazy"
                        ref={imageRef}
                        src={capturedImage || uploadedImage}
                        alt="Body scan"
                        className="w-full h-full object-contain"
                      />
                      {poseDetected && (
                        <canvas
                          ref={canvasRef}
                          className="absolute inset-0 w-full h-full"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <User className="w-20 h-20 mb-4 opacity-50" />
                      <p className="text-sm">Capture or upload a full-body photo</p>
                      <p className="text-xs mt-2 max-w-xs text-center">
                        Stand straight with arms slightly away from body for best results
                      </p>
                    </div>
                  )}
                  
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-2" />
                        <p>Analyzing body pose...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Canvas for drawing (hidden, used for capture) */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Controls */}
                <div className="flex flex-wrap gap-2">
                  {!cameraActive ? (
                    <>
                      <Button onClick={startCamera} className="bg-blue-600 hover:bg-blue-700" data-testid="start-camera-btn">
                        <Camera className="w-4 h-4 mr-2" />
                        Start Camera
                      </Button>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="upload-btn">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Photo
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </>
                  ) : (
                    <>
                      <Button onClick={captureImage} className="bg-green-600 hover:bg-green-700" data-testid="capture-btn">
                        <Scan className="w-4 h-4 mr-2" />
                        Capture
                      </Button>
                      <Button variant="outline" onClick={stopCamera}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </>
                  )}
                  
                  {(capturedImage || uploadedImage) && (
                    <Button 
                      variant="outline" 
                      onClick={() => { setCapturedImage(null); setUploadedImage(null); setPoseDetected(false); setMeasurements(null); }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                  )}
                </div>

                {/* Tips */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Tips for accurate measurement
                  </p>
                  <ul className="mt-2 space-y-1 text-blue-700 dark:text-blue-300 text-xs">
                    <li>• Stand in front of a plain background</li>
                    <li>• Wear fitted clothing</li>
                    <li>• Ensure full body is visible in frame</li>
                    <li>• Keep arms slightly away from body</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Measurements Display */}
            <div className="space-y-4">
              {/* AI Detected Measurements */}
              {measurements && (
                <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
                      <Check className="w-5 h-5" />
                      AI-Detected Measurements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Height', value: measurements.height, unit: 'cm' },
                        { label: 'Shoulder', value: measurements.shoulder, unit: 'cm' },
                        { label: 'Chest', value: measurements.chest, unit: 'cm' },
                        { label: 'Waist', value: measurements.waist, unit: 'cm' },
                        { label: 'Hip', value: measurements.hip, unit: 'cm' },
                        { label: 'Arm Length', value: measurements.armLength, unit: 'cm' },
                        { label: 'Inseam', value: measurements.inseam, unit: 'cm' },
                        { label: 'Neck', value: measurements.neck, unit: 'cm' }
                      ].map(item => (
                        <div key={item.label} className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <p className="text-xs text-gray-500">{item.label}</p>
                          <p className="text-lg font-bold">{item.value} <span className="text-sm font-normal text-gray-400">{item.unit}</span></p>
                        </div>
                      ))}
                    </div>
                    
                    {/* Category Selector for Size Charts */}
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <Label className="text-sm font-medium mb-2 block">Clothing Category</Label>
                      <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="w-full" data-testid="category-selector">
                          <SelectValue placeholder="Select clothing category" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORY_SIZE_CHARTS).map(([key, chart]) => (
                            <SelectItem key={key} value={key}>
                              {chart.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-500">
                          Available sizes: {CATEGORY_SIZE_CHARTS[selectedCategory]?.sizes.join(', ')}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowSizeGuide(true)}
                          className="text-purple-600 hover:text-purple-700 h-auto py-1"
                          data-testid="size-guide-btn"
                        >
                          <HelpCircle className="w-4 h-4 mr-1" />
                          Size Guide
                        </Button>
                      </div>
                    </div>

                    {/* Size Recommendation */}
                    {sizeRecommendation && (
                      <div className="mt-4 p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-purple-600 dark:text-purple-300">Recommended Size</p>
                          <Badge variant="outline" className="text-purple-600">
                            {CATEGORY_SIZE_CHARTS[selectedCategory]?.label || 'Tops'}
                          </Badge>
                        </div>
                        <p className="text-3xl font-bold text-purple-700 dark:text-purple-200">{sizeRecommendation.recommendedSize}</p>
                        <div className="mt-2 flex gap-2 flex-wrap">
                          {sizeRecommendation?.fitAnalysis && Object.entries(sizeRecommendation.fitAnalysis).map(([key, fit]) => (
                            <Badge 
                              key={key}
                              className={fit === 'perfect' ? 'bg-green-500' : fit === 'loose' ? 'bg-blue-500' : 'bg-amber-500'}
                            >
                              {key}: {fit}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-purple-500 mt-3">
                          Confidence: {sizeRecommendation.confidence}%
                        </p>
                      </div>
                    )}
                    
                    <Button onClick={saveMeasurements} className="w-full mt-4 bg-green-600 hover:bg-green-700" data-testid="save-measurements-btn">
                      <Save className="w-4 h-4 mr-2" />
                      Save Measurements
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Manual Measurements */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Ruler className="w-5 h-5 text-orange-600" />
                    Enter Manual Measurements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'chest', label: 'Chest (cm)' },
                      { key: 'waist', label: 'Waist (cm)' },
                      { key: 'hip', label: 'Hip (cm)' },
                      { key: 'shoulder', label: 'Shoulder (cm)' },
                      { key: 'armLength', label: 'Arm Length (cm)' },
                      { key: 'inseam', label: 'Inseam (cm)' },
                      { key: 'neck', label: 'Neck (cm)' }
                    ].map(item => (
                      <div key={item.key}>
                        <Label className="text-xs">{item.label}</Label>
                        <Input
                          type="number"
                          value={customMeasurements[item.key]}
                          onChange={(e) => setCustomMeasurements({ ...customMeasurements, [item.key]: e.target.value })}
                          placeholder="0"
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                  <Button onClick={saveCustomMeasurements} variant="outline" className="w-full mt-4" data-testid="save-custom-btn">
                    <Save className="w-4 h-4 mr-2" />
                    Save Custom Measurements
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Virtual Try-On Tab */}
        <TabsContent value="tryon" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Clothing Selection */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Select Clothing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {clothingItems.length > 0 ? clothingItems.map(item => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedClothing?.id === item.id 
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      onClick={() => setSelectedClothing(item)}
                    >
                      <div className="flex gap-3">
                        {item.image ? (
                          <img loading="lazy" src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                            <Shirt className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.category}</p>
                          <p className="text-sm font-semibold text-purple-600 mt-1">{currencySymbol}{item.selling_price}</p>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      <Shirt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No clothing items available</p>
                    </div>
                  )}
                </div>
                
                {/* Fabric Selection for Custom Try-On */}
                {fabrics.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-600" />
                      Apply Custom Fabric
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => setSelectedFabric(null)}
                        className={`aspect-square rounded-lg border-2 transition-all flex items-center justify-center text-xs ${
                          !selectedFabric ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        Original
                      </button>
                      {fabrics.slice(0, 7).map(fabric => (
                        <button
                          key={fabric.id}
                          onClick={() => setSelectedFabric(fabric)}
                          className={`aspect-square rounded-lg border-2 overflow-hidden transition-all ${
                            selectedFabric?.id === fabric.id ? 'border-purple-500 ring-2 ring-purple-300' : 'border-gray-200 hover:border-purple-300'
                          }`}
                          title={fabric.name}
                        >
                          {fabric.image_url ? (
                            <img loading="lazy" 
                              src={fabric.image_url.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${fabric.image_url}` : fabric.image_url}
                              alt={fabric.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs text-gray-500">
                              {fabric.name.charAt(0)}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {selectedFabric && (
                      <p className="text-xs text-purple-600 mt-2">
                        Selected: {selectedFabric.name} - {currencySymbol}{selectedFabric.price_per_meter}/m
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Try-On Preview */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Virtual Fitting Preview
                  {selectedFabric && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      Custom: {selectedFabric.name}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!measurements ? (
                  <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Measurements Required</p>
                      <p className="text-sm mt-2">Please complete body measurement first</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setActiveTab('measure')}
                      >
                        Go to Measurement
                      </Button>
                    </div>
                  </div>
                ) : !selectedClothing ? (
                  <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Shirt className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Select Clothing</p>
                      <p className="text-sm mt-2">Choose an item from the list to try on</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Selected Item Preview with Fabric Overlay */}
                    <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="relative w-24 h-24 rounded overflow-hidden">
                        {selectedClothing.image ? (
                          <img loading="lazy" src={selectedClothing.image} alt={selectedClothing.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <Shirt className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        {/* Fabric overlay effect */}
                        {selectedFabric?.image_url && (
                          <div 
                            className="absolute inset-0 mix-blend-multiply opacity-70"
                            style={{
                              backgroundImage: `url(${selectedFabric.image_url.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + selectedFabric.image_url : selectedFabric.image_url})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center'
                            }}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold">{selectedClothing.name}</h3>
                        <p className="text-sm text-gray-500">{selectedClothing.description}</p>
                        {selectedFabric && (
                          <p className="text-xs text-purple-600 mt-1">
                            Custom fabric: {selectedFabric.name}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-4">
                          <span className="text-lg font-bold text-purple-600">{currencySymbol}{selectedClothing.selling_price}</span>
                          {sizeRecommendation && (
                            <Badge className="bg-green-500">
                              Size: {sizeRecommendation.recommendedSize}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fit Analysis */}
                    {sizeRecommendation?.fitAnalysis && Object.keys(sizeRecommendation.fitAnalysis).length > 0 && (
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3">Fit Analysis</h4>
                        <div className="grid grid-cols-3 gap-4">
                          {Object.entries(sizeRecommendation.fitAnalysis).map(([area, fit]) => (
                            <div key={area} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                              <p className="text-xs text-gray-500 capitalize">{area}</p>
                              <p className={`font-medium ${
                                fit === 'perfect' ? 'text-green-600' : 
                                fit === 'loose' ? 'text-blue-600' : 'text-amber-600'
                              }`}>
                                {fit === 'perfect' ? '✓ Perfect' : fit === 'loose' ? '↔ Loose' : '↔ Tight'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom Stitch Request */}
                    {selectedFabric && (
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">
                          Custom Stitching Available
                        </h4>
                        <p className="text-sm text-purple-600 dark:text-purple-300 mb-3">
                          Get this {selectedClothing.name} tailored with {selectedFabric.name} fabric
                        </p>
                        <div className="text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Estimated Price: </span>
                          <span className="font-bold text-purple-700 dark:text-purple-300">
                            {currencySymbol}{(selectedFabric.price_per_meter * 2.5 + 500).toFixed(0)}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">(fabric + stitching)</span>
                        </div>
                        <Button 
                          className="mt-3 bg-purple-600 hover:bg-purple-700 w-full"
                          onClick={() => {
                            toast.success('Request sent! Our tailor will contact you soon.');
                          }}
                        >
                          Request Custom Stitch
                        </Button>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <Button 
                        onClick={performTryOn}
                        disabled={isLoading}
                        className="flex-1 bg-purple-600 hover:bg-purple-700"
                        data-testid="try-on-btn"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shirt className="w-4 h-4 mr-2" />}
                        Virtual Try-On
                      </Button>
                      <Button 
                        onClick={() => proceedToOrder('purchase')}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        data-testid="buy-now-btn"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Buy Now
                      </Button>
                      <Button 
                        onClick={() => proceedToOrder('stitching')}
                        variant="outline"
                        className="flex-1"
                        data-testid="custom-stitch-btn"
                      >
                        <Scissors className="w-4 h-4 mr-2" />
                        Custom Stitching
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Saved Profiles Tab */}
        <TabsContent value="saved" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Save className="w-5 h-5 text-blue-600" />
                Saved Measurement Profiles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savedMeasurements.length > 0 ? (
                <div className="space-y-4">
                  {savedMeasurements.map((profile, index) => (
                    <div key={profile.id || index} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <Badge className={profile.source === 'ai_detection' ? 'bg-purple-500' : 'bg-blue-500'}>
                            {profile.source === 'ai_detection' ? 'AI Detected' : 'Manual'}
                          </Badge>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(profile.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setMeasurements(profile);
                            setSizeRecommendation(determineSizeRecommendation(profile, selectedCategory));
                            toast.success('Profile loaded');
                          }}
                        >
                          Use This
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div><span className="text-gray-500">Height:</span> {profile.height}cm</div>
                        <div><span className="text-gray-500">Chest:</span> {profile.chest}cm</div>
                        <div><span className="text-gray-500">Waist:</span> {profile.waist}cm</div>
                        <div><span className="text-gray-500">Hip:</span> {profile.hip}cm</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Save className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No saved measurement profiles</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setActiveTab('measure')}
                  >
                    Create New Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Size Guide Dialog */}
      <SizeGuideDialog 
        open={showSizeGuide} 
        onClose={setShowSizeGuide} 
        category={selectedCategory}
      />
    </div>
  );
}
