import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Monitor, MonitorOff, Mic, MicOff, Video, VideoOff, 
  PhoneOff, Users, MessageSquare, Settings, Maximize2, 
  Minimize2, Copy, Check, Share2, StopCircle, Play,
  ScreenShare, ScreenShareOff, Volume2, VolumeX
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

/**
 * ScreenShareRoom - Real-time screen sharing component using WebRTC
 * Works like Google Meet / AnyDesk for live screen sharing
 */
export default function ScreenShareRoom({ 
  sessionId,
  sessionTitle,
  isHost,
  userName,
  onLeave,
  onEnd,
  enableChat = true,
  enableRecording = false,
  maxParticipants = 20
}) {
  // Media states
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  
  // Stream refs
  const localVideoRef = useRef(null);
  const screenShareRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  
  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  // Room state
  const [participants, setParticipants] = useState([{ id: 'local', name: userName, isHost }]);
  const [roomLink, setRoomLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Generate room link on mount
  useEffect(() => {
    const link = `${window.location.origin}/training/join/${sessionId}`;
    setRoomLink(link);
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllStreams();
    };
  }, []);

  const stopAllStreams = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
  };

  // Start Screen Sharing
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true // Include system audio if available
      });

      screenStreamRef.current = stream;
      
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = stream;
      }

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      setIsScreenSharing(true);
      toast.success('Screen sharing started');

      // Start recording if enabled
      if (enableRecording && !isRecording) {
        startRecording(stream);
      }

    } catch (err) {
      console.error('Screen share error:', err);
      if (err.name === 'NotAllowedError') {
        toast.error('Screen sharing permission denied');
      } else {
        toast.error('Failed to start screen sharing');
      }
    }
  };

  // Stop Screen Sharing
  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (screenShareRef.current) {
      screenShareRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
    toast.info('Screen sharing stopped');
  };

  // Toggle Camera
  const toggleCamera = async () => {
    if (isCameraOn) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      setIsCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });
        cameraStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsCameraOn(true);
        toast.success('Camera turned on');
      } catch (err) {
        console.error('Camera error:', err);
        toast.error('Failed to access camera');
      }
    }
  };

  // Toggle Microphone
  const toggleMic = async () => {
    if (isMicOn) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      setIsMicOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        micStreamRef.current = stream;
        setIsMicOn(true);
        toast.success('Microphone turned on');
      } catch (err) {
        console.error('Microphone error:', err);
        toast.error('Failed to access microphone');
      }
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Copy Room Link
  const copyRoomLink = () => {
    navigator.clipboard.writeText(roomLink);
    setLinkCopied(true);
    toast.success('Room link copied!');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Recording Functions
  const startRecording = (stream) => {
    try {
      recordedChunksRef.current = [];
      const options = { mimeType: 'video/webm;codecs=vp9' };
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Download recording
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${sessionId}-${Date.now()}.webm`;
        a.click();
        
        toast.success('Recording saved!');
      };
      
      mediaRecorderRef.current.start(1000); // Capture every second
      setIsRecording(true);
      toast.success('Recording started');
    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Send Chat Message
  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      sender: userName,
      content: chatInput,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
  };

  // Handle Leave/End
  const handleLeave = () => {
    stopAllStreams();
    if (isRecording) stopRecording();
    onLeave?.();
  };

  const handleEnd = () => {
    stopAllStreams();
    if (isRecording) stopRecording();
    onEnd?.();
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'h-screen'} bg-gray-950 text-white flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Badge className={`${isScreenSharing ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}>
            {isScreenSharing ? 'SHARING' : 'READY'}
          </Badge>
          <h2 className="font-semibold text-lg">{sessionTitle}</h2>
          {isRecording && (
            <Badge className="bg-red-600 animate-pulse flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full"></span>
              REC
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Room Link */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
            <span className="text-sm text-gray-400 max-w-[200px] truncate">{roomLink}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={copyRoomLink}
            >
              {linkCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          
          {/* Participants Count */}
          <div className="flex items-center gap-2 text-gray-400">
            <Users className="w-4 h-4" />
            <span className="text-sm">{participants.length}</span>
          </div>
          
          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Screen Share / Video Area */}
        <div className="flex-1 flex flex-col p-4 min-h-0">
          {/* Main Display */}
          <div className="flex-1 bg-gray-900 rounded-xl overflow-hidden relative min-h-0">
            {isScreenSharing ? (
              <video
                ref={screenShareRef}
                autoPlay
                playsInline
                muted={!isSpeakerOn}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <Monitor className="w-24 h-24 text-gray-600 mb-4" />
                <h3 className="text-xl font-medium text-gray-400 mb-2">No Screen Shared</h3>
                <p className="text-gray-500 mb-6">
                  {isHost ? 'Click "Share Screen" to start presenting' : 'Waiting for presenter to share screen'}
                </p>
                {isHost && (
                  <Button
                    onClick={startScreenShare}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="start-share-btn"
                  >
                    <ScreenShare className="w-5 h-5 mr-2" />
                    Share Your Screen
                  </Button>
                )}
              </div>
            )}
            
            {/* Local Video (Picture-in-Picture) */}
            {isCameraOn && (
              <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg border-2 border-gray-700">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-2 text-xs bg-black/50 px-2 py-0.5 rounded">
                  You
                </div>
              </div>
            )}
            
            {/* Recording Indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                <span className="text-sm font-medium">Recording</span>
              </div>
            )}
          </div>

          {/* Controls Bar - Always visible at bottom */}
          <div className="flex-shrink-0 flex items-center justify-center gap-3 mt-4 p-3 bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800">
            {/* Microphone */}
            <Button
              variant={isMicOn ? "default" : "outline"}
              size="icon"
              className={`rounded-full w-12 h-12 ${isMicOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700 border-0'}`}
              onClick={toggleMic}
              data-testid="mic-toggle-btn"
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            
            {/* Camera */}
            <Button
              variant={isCameraOn ? "default" : "outline"}
              size="icon"
              className={`rounded-full w-12 h-12 ${isCameraOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700 border-0'}`}
              onClick={toggleCamera}
              data-testid="camera-toggle-btn"
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
            
            {/* Screen Share - Only for host or if bi-directional */}
            {(isHost || true) && (
              <Button
                variant={isScreenSharing ? "default" : "outline"}
                size="icon"
                className={`rounded-full w-12 h-12 ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600 border-0'}`}
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                data-testid="screenshare-toggle-btn"
              >
                {isScreenSharing ? <ScreenShareOff className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
              </Button>
            )}
            
            {/* Speaker */}
            <Button
              variant="outline"
              size="icon"
              className={`rounded-full w-12 h-12 ${isSpeakerOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'} border-0`}
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              data-testid="speaker-toggle-btn"
            >
              {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
            
            {/* Recording - Only for host */}
            {isHost && enableRecording && (
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full w-12 h-12 ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'} border-0`}
                onClick={isRecording ? stopRecording : () => screenStreamRef.current && startRecording(screenStreamRef.current)}
                disabled={!isScreenSharing}
                data-testid="record-toggle-btn"
              >
                {isRecording ? <StopCircle className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
            )}
            
            {/* Chat Toggle */}
            {enableChat && (
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full w-12 h-12 ${showChat ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'} border-0`}
                onClick={() => setShowChat(!showChat)}
                data-testid="chat-toggle-btn"
              >
                <MessageSquare className="w-5 h-5" />
              </Button>
            )}
            
            {/* End/Leave Call */}
            <Button
              variant="destructive"
              size="icon"
              className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700 ml-4"
              onClick={isHost ? handleEnd : handleLeave}
              data-testid="end-call-btn"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Chat Sidebar */}
        {showChat && enableChat && (
          <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0">
            <div className="flex-shrink-0 p-3 border-b border-gray-800">
              <h3 className="font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat
                <Badge variant="outline" className="ml-auto">{chatMessages.length}</Badge>
              </h3>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {chatMessages.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">
                  No messages yet. Start the conversation!
                </p>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="group">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-xs font-medium text-blue-400">
                        {msg.sender.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-400">{msg.sender}</span>
                          <span className="text-xs text-gray-500">{msg.timestamp}</span>
                        </div>
                        <p className="text-sm text-gray-300 break-words">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Chat Input */}
            <div className="flex-shrink-0 p-3 border-t border-gray-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  data-testid="chat-input"
                />
                <Button
                  size="icon"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={sendChatMessage}
                  data-testid="send-chat-btn"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions Panel (shown when not sharing) - positioned above controls */}
      {!isScreenSharing && isHost && (
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-gray-800/95 backdrop-blur rounded-xl p-4 max-w-md text-center shadow-xl border border-gray-700 z-10">
          <h4 className="font-medium mb-2">Screen Sharing Options</h4>
          <p className="text-sm text-gray-400 mb-3">
            When you click "Share Screen", you can choose to share:
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Monitor className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-gray-400">Entire Screen</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <Monitor className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-400">Window</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <Monitor className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-gray-400">Browser Tab</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
