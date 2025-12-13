import { useState, useEffect } from 'react';

interface Room {
    roomId: string;
    code: string;
    players: number;
    maxPlayers: number;
}

interface LobbyProps {
    onJoinRoom: (roomId: string) => void;
    onCreateRoom: () => void;
}

export const Lobby = ({ onJoinRoom, onCreateRoom }: LobbyProps) => {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomCode, setRoomCode] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const response = await fetch('http://localhost:2567/rooms');
                const data = await response.json();
                setRooms(data);
            } catch (error) {
                console.error("Error fetching rooms:", error);
            }
        };

        fetchRooms();
        const interval = setInterval(fetchRooms, 2000);

        return () => clearInterval(interval);
    }, []);

    const handleJoinByCode = async () => {
        if (!roomCode.trim()) return;
        setLoading(true);
        try {
            // Find room by code
            const response = await fetch('http://localhost:2567/rooms');
            const allRooms = await response.json();
            const room = allRooms.find((r: Room) => r.code === roomCode.toUpperCase());
            
            if (room) {
                onJoinRoom(room.roomId);
            } else {
                alert("Room not found!");
            }
        } catch (error) {
            console.error("Error joining room:", error);
            alert("Error joining room");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pixel-lobby">
            <div className="pixel-bg"></div>
            <div className="lobby-container">
                <h1 className="lobby-title">
                    🚗 COCHE REBELDE 3D
                </h1>
                <div className="lobby-subtitle">PIXEL EDITION</div>

                <div className="lobby-section">
                    <div className="section-header">JOIN BY CODE</div>
                    <div className="code-input-group">
                        <input
                            type="text"
                            className="pixel-input"
                            placeholder="ENTER CODE"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            maxLength={6}
                            onKeyPress={(e) => e.key === 'Enter' && handleJoinByCode()}
                        />
                        <button
                            className="pixel-button"
                            onClick={handleJoinByCode}
                            disabled={loading || !roomCode.trim()}
                        >
                            JOIN
                        </button>
                    </div>
                </div>

                <div className="lobby-section">
                    <div className="section-header">AVAILABLE ROOMS</div>
                    <div className="rooms-list">
                        {rooms.length > 0 ? (
                            rooms.map((room) => (
                                <div key={room.roomId} className="room-item">
                                    <div className="room-code">{room.code}</div>
                                    <div className="room-players">
                                        {room.players}/{room.maxPlayers}
                                    </div>
                                    <button
                                        className="pixel-button small"
                                        onClick={() => onJoinRoom(room.roomId)}
                                        disabled={room.players >= room.maxPlayers}
                                    >
                                        JOIN
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="no-rooms">No rooms available</div>
                        )}
                    </div>
                </div>

                <div className="lobby-section">
                    <button
                        className="pixel-button large"
                        onClick={() => {
                            console.log("Create room clicked");
                            onCreateRoom();
                        }}
                    >
                        CREATE NEW ROOM
                    </button>
                </div>
            </div>
        </div>
    );
};

