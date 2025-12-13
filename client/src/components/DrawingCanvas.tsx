import { useEffect, useRef, useState } from 'react';

interface DrawingCanvasProps {
    onComplete: (canvasData: string) => void;
    timeLimit: number;
    showPrevious?: boolean;
    previousDrawing?: string;
}

export const DrawingCanvas = ({ onComplete, timeLimit, showPrevious = false, previousDrawing }: DrawingCanvasProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [timeLeft, setTimeLeft] = useState(timeLimit);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = 600;
        canvas.height = 400;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Drawing handlers
        const startDrawing = (e: MouseEvent | TouchEvent) => {
            setIsDrawing(true);
            const point = getPoint(e);
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
        };

        const draw = (e: MouseEvent | TouchEvent) => {
            if (!isDrawing) return;
            e.preventDefault();
            const point = getPoint(e);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
        };

        const stopDrawing = () => {
            if (isDrawing) {
                setIsDrawing(false);
            }
        };

        const getPoint = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            if ('touches' in e) {
                return {
                    x: e.touches[0].clientX - rect.left,
                    y: e.touches[0].clientY - rect.top
                };
            }
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseleave', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        };
    }, [isDrawing]);

    // Timer
    useEffect(() => {
        if (timeLeft <= 0) {
            const canvas = canvasRef.current;
            if (canvas) {
                const dataUrl = canvas.toDataURL();
                onComplete(dataUrl);
            }
            return;
        }

        timerRef.current = setTimeout(() => {
            setTimeLeft(timeLeft - 100);
        }, 100);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [timeLeft, onComplete]);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    return (
        <div className="drawing-container">
            {showPrevious && previousDrawing && (
                <div className="previous-drawing-container">
                    <p>Dibujo anterior:</p>
                    <img src={previousDrawing} alt="Previous" className="previous-drawing-small" />
                </div>
            )}
            <div className="canvas-wrapper">
                <canvas
                    ref={canvasRef}
                    className="drawing-canvas"
                    style={{ border: '2px solid #333', cursor: 'crosshair' }}
                />
                <div className="canvas-controls">
                    <button onClick={clearCanvas} className="clear-button">🗑️ Limpiar</button>
                    <div className="timer">⏱️ {Math.ceil(timeLeft / 1000)}s</div>
                </div>
            </div>
        </div>
    );
};

