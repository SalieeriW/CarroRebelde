import { useEffect, useRef, useState, useCallback } from 'react';
import * as Colyseus from 'colyseus.js';

interface AudioChatProps {
    room: Colyseus.Room | null;
    mySessionId: string;
    myRole: string;
    enabled?: boolean; // Enable/disable audio chat
}

export const AudioChat: React.FC<AudioChatProps> = ({ room, mySessionId, myRole, enabled = true }) => {
    const [isMuted, setIsMuted] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [speakingPlayers, setSpeakingPlayers] = useState<Set<string>>(new Set());
    
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
    const handleSignalingRef = useRef<((message: any) => Promise<void>) | null>(null);
    const createPeerConnectionRef = useRef<((remoteSessionId: string, remotePlayer: any) => Promise<RTCPeerConnection | null>) | null>(null);

    // Initialize audio chat
    useEffect(() => {
        if (!room || !enabled) return;

        const initializeAudio = async () => {
            try {
                // Get user media (microphone)
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    } 
                });
                
                localStreamRef.current = stream;
                setIsConnected(true);
                console.log('🎤 Audio chat initialized');

                // Listen for signaling messages
                room.onMessage('audio_signal', (message: any) => {
                    if (handleSignalingRef.current) {
                        handleSignalingRef.current(message);
                    }
                });

                // When a new player joins, create offer
                room.onStateChange((state) => {
                    const players = state.players;
                    if (players && createPeerConnectionRef.current) {
                        players.forEach((player: any, sessionId: string) => {
                            if (sessionId !== mySessionId && !peerConnectionsRef.current.has(sessionId)) {
                                createPeerConnectionRef.current(sessionId, player);
                            }
                        });
                    }
                });

            } catch (error) {
                console.error('Failed to initialize audio chat:', error);
                setIsConnected(false);
            }
        };

        initializeAudio();

        return () => {
            // Cleanup
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
            peerConnectionsRef.current.forEach(pc => pc.close());
            peerConnectionsRef.current.clear();
            remoteStreamsRef.current.clear();
            audioElementsRef.current.forEach(audio => {
                audio.pause();
                audio.srcObject = null;
            });
            audioElementsRef.current.clear();
        };
    }, [room, mySessionId, enabled]);

    const setupPeerConnection = useCallback((pc: RTCPeerConnection, remoteSessionId: string) => {
        // Handle remote stream
        pc.ontrack = (event) => {
            const remoteStream = event.streams[0];
            remoteStreamsRef.current.set(remoteSessionId, remoteStream);
            
            // Create audio element for remote stream
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.autoplay = true;
            audio.volume = 0.8;
            audioElementsRef.current.set(remoteSessionId, audio);
            
            // Detect speaking
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(remoteStream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const checkSpeaking = () => {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                
                if (average > 30) {
                    setSpeakingPlayers(prev => new Set(prev).add(remoteSessionId));
                } else {
                    setSpeakingPlayers(prev => {
                        const next = new Set(prev);
                        next.delete(remoteSessionId);
                        return next;
                    });
                }
                
                if (remoteStreamsRef.current.has(remoteSessionId)) {
                    requestAnimationFrame(checkSpeaking);
                }
            };
            checkSpeaking();
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && room) {
                room.send('audio_signal', {
                    type: 'ice-candidate',
                    to: remoteSessionId,
                    candidate: event.candidate
                });
            }
        };
    }, [room]);

    const createPeerConnection = useCallback(async (remoteSessionId: string, remotePlayer: any) => {
        if (!room || !localStreamRef.current) return null;

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        // Add local stream tracks
        localStreamRef.current.getTracks().forEach(track => {
            if (!isMuted) {
                pc.addTrack(track, localStreamRef.current!);
            }
        });

        setupPeerConnection(pc, remoteSessionId);
        peerConnectionsRef.current.set(remoteSessionId, pc);

        // Create offer if we're the driver (initiator)
        if (myRole === 'driver') {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                
                room.send('audio_signal', {
                    type: 'offer',
                    to: remoteSessionId,
                    offer: offer
                });
            } catch (error) {
                console.error('Error creating offer:', error);
            }
        }

        return pc;
    }, [room, mySessionId, myRole, isMuted, setupPeerConnection]);

    // Update refs when functions are created
    useEffect(() => {
        createPeerConnectionRef.current = createPeerConnection;
    }, [createPeerConnection]);

    const handleSignaling = useCallback(async (message: any) => {
        if (message.to !== mySessionId || !room || !localStreamRef.current) return;

        let pc = peerConnectionsRef.current.get(message.from);
        
        // Create peer connection if it doesn't exist
        if (!pc) {
            pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // Add local stream tracks
            localStreamRef.current.getTracks().forEach(track => {
                if (!isMuted) {
                    pc!.addTrack(track, localStreamRef.current!);
                }
            });

            setupPeerConnection(pc, message.from);
            peerConnectionsRef.current.set(message.from, pc);
        }

        try {
            if (message.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                room.send('audio_signal', {
                    type: 'answer',
                    to: message.from,
                    answer: answer
                });
            } else if (message.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
            } else if (message.type === 'ice-candidate') {
                await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
            }
        } catch (error) {
            console.error('Error handling signaling:', error);
        }
    }, [room, mySessionId, isMuted, setupPeerConnection]);

    // Update refs when functions are created
    useEffect(() => {
        handleSignalingRef.current = handleSignaling;
    }, [handleSignaling]);

    const toggleMute = useCallback(() => {
        if (!localStreamRef.current) return;

        const newMuted = !isMuted;
        setIsMuted(newMuted);

        // Mute/unmute all tracks
        localStreamRef.current.getTracks().forEach(track => {
            track.enabled = !newMuted;
        });

        // Update peer connections
        peerConnectionsRef.current.forEach((pc, sessionId) => {
            const senders = pc.getSenders();
            senders.forEach(sender => {
                if (sender.track) {
                    sender.track.enabled = !newMuted;
                }
            });
        });
    }, [isMuted]);

    if (!enabled) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'flex-end'
        }}>
            {/* Speaking indicators */}
            {speakingPlayers.size > 0 && (
                <div style={{
                    background: '#1a1a2e',
                    border: '3px solid #00ff88',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '10px',
                    color: '#00ff88'
                }}>
                    🎤 {speakingPlayers.size} hablando
                </div>
            )}

            {/* Mute button */}
            <button
                onClick={toggleMute}
                style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    border: '4px solid #16213e',
                    background: isMuted ? '#e94560' : (isConnected ? '#00ff88' : '#666'),
                    color: '#000',
                    fontSize: '24px',
                    cursor: 'pointer',
                    fontFamily: '"Press Start 2P", monospace',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '4px 4px 0px #0f0f23'
                }}
                title={isMuted ? 'Desactivar silencio' : 'Silenciar micrófono'}
            >
                {isMuted ? '🔇' : '🎤'}
            </button>
        </div>
    );
};

