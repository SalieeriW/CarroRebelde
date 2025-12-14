import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

interface AudioSystemProps {
    hornActive: boolean;
    radioStation: string;
    turboActive: boolean;
    bgmEnabled?: boolean; // New prop for BGM toggle
    minigameActive?: boolean; // Disable audio during minigame
}

export const AudioSystem = forwardRef<any, AudioSystemProps>(({ hornActive, radioStation, turboActive, bgmEnabled = true, minigameActive = false }, ref) => {
    const hornAudioRef = useRef<HTMLAudioElement | null>(null);
    const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
    const hornIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useImperativeHandle(ref, () => ({
        playHorn: () => {
            playHornSound();
        },
        playTurbo: () => {
            // Turbo sound can stay synthetic or be removed
        }
    }));

    // Initialize audio elements
    useEffect(() => {
        // Claxon audio
        hornAudioRef.current = new Audio('/claxon.mp3');
        hornAudioRef.current.volume = 0.7;
        hornAudioRef.current.preload = 'auto';

        // BGM audio
        bgmAudioRef.current = new Audio('/bgm.mp3');
        bgmAudioRef.current.volume = 0.5;
        bgmAudioRef.current.loop = true;
        bgmAudioRef.current.preload = 'auto';

        return () => {
            if (hornAudioRef.current) {
                hornAudioRef.current.pause();
                hornAudioRef.current = null;
            }
            if (bgmAudioRef.current) {
                bgmAudioRef.current.pause();
                bgmAudioRef.current = null;
            }
            if (hornIntervalRef.current) {
                clearInterval(hornIntervalRef.current);
            }
        };
    }, []);

    const playHornSound = () => {
        if (hornAudioRef.current) {
            hornAudioRef.current.currentTime = 0; // Reset to start
            hornAudioRef.current.play().catch(err => {
                console.warn('Failed to play horn sound:', err);
            });
        }
    };

    // Horn effect - play claxon when active (but not during minigame)
    useEffect(() => {
        if (hornActive && !minigameActive) {
            playHornSound();
            // Repeat claxon sound while active
            hornIntervalRef.current = setInterval(() => {
                if (hornActive && !minigameActive) {
                    playHornSound();
                }
            }, 500); // Repeat every 500ms
            return () => {
                if (hornIntervalRef.current) {
                    clearInterval(hornIntervalRef.current);
                    hornIntervalRef.current = null;
                }
            };
        } else {
            if (hornIntervalRef.current) {
                clearInterval(hornIntervalRef.current);
                hornIntervalRef.current = null;
            }
            // Pause horn audio if minigame is active
            if (minigameActive && hornAudioRef.current) {
                hornAudioRef.current.pause();
            }
        }
    }, [hornActive, minigameActive]);

    // BGM effect - play bgm.mp3 when radio is not "normal" and BGM is enabled (but not during minigame)
    useEffect(() => {
        if (!bgmAudioRef.current) return;

        const shouldPlay = bgmEnabled && radioStation !== "normal" && !minigameActive;

        if (shouldPlay) {
            bgmAudioRef.current.play().catch(err => {
                console.warn('Failed to play BGM:', err);
            });
        } else {
            bgmAudioRef.current.pause();
            // Don't reset currentTime if minigame is active (so it can resume where it left off)
            if (!minigameActive) {
                bgmAudioRef.current.currentTime = 0; // Reset to start when paused
            }
        }
    }, [radioStation, bgmEnabled, minigameActive]);

    // Turbo effect (keep existing synthetic sound or remove)
    useEffect(() => {
        // Turbo sound can be added later if needed
    }, [turboActive]);

    return null;
});
