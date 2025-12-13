import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

interface AudioSystemProps {
    hornActive: boolean;
    radioStation: string;
    turboActive: boolean;
}

export const AudioSystem = forwardRef<any, AudioSystemProps>(({ hornActive, radioStation, turboActive }, ref) => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const hornOscillatorRef = useRef<OscillatorNode | null>(null);
    const radioOscillatorRef = useRef<OscillatorNode | null>(null);

    useImperativeHandle(ref, () => ({
        playHorn: () => {
            playHornSound();
        },
        playTurbo: () => {
            playTurboSound();
        }
    }));

    useEffect(() => {
        // Initialize Web Audio API
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.warn("Web Audio API not supported");
        }
    }, []);

    const playHornSound = () => {
        if (!audioContextRef.current) return;

        if (hornOscillatorRef.current) {
            hornOscillatorRef.current.stop();
        }

        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(400, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start();
        hornOscillatorRef.current = oscillator;

        // Stop after short duration
        setTimeout(() => {
            if (hornOscillatorRef.current) {
                hornOscillatorRef.current.stop();
                hornOscillatorRef.current = null;
            }
        }, 200);
    };

    const playTurboSound = () => {
        if (!audioContextRef.current) return;

        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
    };

    // Horn effect
    useEffect(() => {
        if (hornActive) {
            playHornSound();
            const interval = setInterval(() => {
                if (hornActive) {
                    playHornSound();
                }
            }, 300);
            return () => clearInterval(interval);
        }
    }, [hornActive]);

    // Radio effect
    useEffect(() => {
        if (!audioContextRef.current) return;

        if (radioOscillatorRef.current) {
            radioOscillatorRef.current.stop();
            radioOscillatorRef.current = null;
        }

        if (radioStation === "normal") {
            return;
        }

        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        if (radioStation === "absurd1") {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(300, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        } else if (radioStation === "absurd2") {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(150, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        }

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        radioOscillatorRef.current = oscillator;

        return () => {
            if (radioOscillatorRef.current) {
                radioOscillatorRef.current.stop();
                radioOscillatorRef.current = null;
            }
        };
    }, [radioStation]);

    // Turbo effect
    useEffect(() => {
        if (turboActive) {
            playTurboSound();
        }
    }, [turboActive]);

    return null;
});

