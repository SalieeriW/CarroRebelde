// Helper function to draw F1 circuit map in plan view
export function drawCircuitMap(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    carPosition: { x: number; z: number; angle: number },
    traps: any[],
    pathHistory: Array<{ x: number; z: number }>,
    startPoint: { x: number; z: number },
    _endPoint: { x: number; z: number },
    viewBounds?: { minX: number; maxX: number; minZ: number; maxZ: number } // Optional: limit view area
) {
    // Circuit parameters
    const centerX = 100;
    const centerZ = 100;
    const radiusX = 80;
    const radiusZ = 60;
    const roadWidth = 8;

    // Calculate view bounds
    let minX: number, maxX: number, minZ: number, maxZ: number;
    
    if (viewBounds) {
        // Use provided bounds (for limited view)
        minX = viewBounds.minX;
        maxX = viewBounds.maxX;
        minZ = viewBounds.minZ;
        maxZ = viewBounds.maxZ;
    } else {
        // Full map view
        minX = centerX - radiusX - roadWidth - 20;
        maxX = centerX + radiusX + roadWidth + 20;
        minZ = centerZ - radiusZ - roadWidth - 20;
        maxZ = centerZ + radiusZ + roadWidth + 20;
    }

    const mapWidth = maxX - minX;
    const mapHeight = maxZ - minZ;
    const scale = Math.min(canvasWidth / mapWidth, canvasHeight / mapHeight) * 0.9;
    
    const offsetX = (canvasWidth - mapWidth * scale) / 2 - minX * scale;
    const offsetZ = (canvasHeight - mapHeight * scale) / 2 - minZ * scale;

    const worldToScreen = (wx: number, wz: number) => {
        return {
            x: offsetX + wx * scale,
            y: offsetZ + wz * scale
        };
    };

    // Clear background
    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw terrain
    ctx.fillStyle = '#1a1a2e';
    for (let x = Math.floor(minX / 20) * 20; x <= maxX; x += 20) {
        for (let z = Math.floor(minZ / 20) * 20; z <= maxZ; z += 20) {
            if ((x + z) % 40 === 0) {
                const screen = worldToScreen(x, z);
                ctx.fillRect(screen.x, screen.y, 20 * scale, 20 * scale);
            }
        }
    }

    // Draw grid
    ctx.strokeStyle = '#00ff0022';
    ctx.lineWidth = 1;
    for (let x = Math.floor(minX / 20) * 20; x <= maxX; x += 20) {
        const screen = worldToScreen(x, minZ);
        ctx.beginPath();
        ctx.moveTo(screen.x, 0);
        ctx.lineTo(screen.x, canvasHeight);
        ctx.stroke();
    }
    for (let z = Math.floor(minZ / 20) * 20; z <= maxZ; z += 20) {
        const screen = worldToScreen(minX, z);
        ctx.beginPath();
        ctx.moveTo(0, screen.y);
        ctx.lineTo(canvasWidth, screen.y);
        ctx.stroke();
    }

    // Draw F1-style circuit road
    const steps = 200;
    const roadPoints: Array<{x: number, z: number, leftWall: {x: number, z: number}, rightWall: {x: number, z: number}}> = [];
    
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        // Oval circuit
        const x = centerX + Math.sin(t) * radiusX;
        const z = centerZ + Math.cos(t) * radiusZ;
        
        // Calculate perpendicular for walls
        const perpX = -Math.cos(t);
        const perpZ = Math.sin(t);
        
        const leftWall = {
            x: x + perpX * roadWidth,
            z: z + perpZ * roadWidth
        };
        const rightWall = {
            x: x - perpX * roadWidth,
            z: z - perpZ * roadWidth
        };
        
        roadPoints.push({ x, z, leftWall, rightWall });
    }

    // Draw outer walls (red)
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 4;
    ctx.beginPath();
    roadPoints.forEach((point, i) => {
        const screen = worldToScreen(point.leftWall.x, point.leftWall.z);
        if (i === 0) {
            ctx.moveTo(screen.x, screen.y);
        } else {
            ctx.lineTo(screen.x, screen.y);
        }
    });
    ctx.closePath();
    ctx.stroke();

    // Draw inner walls (red)
    ctx.beginPath();
    roadPoints.forEach((point, i) => {
        const screen = worldToScreen(point.rightWall.x, point.rightWall.z);
        if (i === 0) {
            ctx.moveTo(screen.x, screen.y);
        } else {
            ctx.lineTo(screen.x, screen.y);
        }
    });
    ctx.closePath();
    ctx.stroke();

    // Draw road surface (yellow - between walls)
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    roadPoints.forEach((point, i) => {
        const screen = worldToScreen(point.x, point.z);
        if (i === 0) {
            ctx.moveTo(screen.x, screen.y);
        } else {
            ctx.lineTo(screen.x, screen.y);
        }
    });
    ctx.closePath();
    ctx.stroke();
    
    // Draw road center line (white dashed)
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw path traveled
    if (pathHistory.length > 1) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        pathHistory.forEach((point, i) => {
            const screen = worldToScreen(point.x, point.z);
            if (i === 0) {
                ctx.moveTo(screen.x, screen.y);
            } else {
                ctx.lineTo(screen.x, screen.y);
            }
        });
        ctx.stroke();
    }

    // Draw START/FINISH line
    const startScreen = worldToScreen(startPoint.x, startPoint.z);
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 6;
    ctx.beginPath();
    // Draw checkered line
    for (let i = -roadWidth; i <= roadWidth; i += 2) {
        const checkX = startScreen.x + Math.sin(Math.PI / 2) * i * scale;
        const checkZ = startScreen.y + Math.cos(Math.PI / 2) * i * scale;
        ctx.fillStyle = (Math.floor(i / 2) % 2 === 0) ? "#ffffff" : "#000000";
        ctx.fillRect(checkX - 10, checkZ - 20, 20, 40);
    }
    ctx.stroke();
    
    // START/FINISH label
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("START/FINISH", startScreen.x, startScreen.y - 30);

    // Draw traps
    traps.forEach((trap) => {
        const trapScreen = worldToScreen(trap.x, trap.z);
        const radius = trap.radius * scale;
        
        // Trap color by type
        ctx.fillStyle = trap.type === "spike" ? "#ff0000" : 
                       trap.type === "puddle" ? "#0066ff" :
                       trap.type === "spin" ? "#ff00ff" : "#ffff00";
        
        ctx.beginPath();
        ctx.arc(trapScreen.x, trapScreen.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
    });


    // Draw car
    const carScreen = worldToScreen(carPosition.x, carPosition.z);
    ctx.save();
    ctx.translate(carScreen.x, carScreen.y);
    ctx.rotate(carPosition.angle);
    
    ctx.fillStyle = "#ff6600";
    ctx.fillRect(-12, -18, 24, 36);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.strokeRect(-12, -18, 24, 36);
    ctx.fillStyle = "#0066ff44";
    ctx.fillRect(-10, -15, 20, 12);
    ctx.fillStyle = "#ffff00";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(-8, -30);
    ctx.lineTo(8, -30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    return { worldToScreen, scale };
}

