# 🐳 Docker Setup - Blind Rally

Este proyecto incluye la aplicación principal y el minijuego "Two Keys Gate" configurados con Docker Compose.

## 🚀 Inicio Rápido

### Con Docker Compose (Recomendado)

```bash
# Construir y levantar todos los servicios
docker-compose up --build

# O en modo detached (background)
docker-compose up -d --build
```

Esto levantará:
- **Blind Rally Server**: `http://localhost:2567`
- **Blind Rally Client**: `http://localhost:5173`
- **Two Keys Gate Server**: `http://localhost:3001`
- **Two Keys Gate Client**: `http://localhost:5174`

### Acceso

1. Abre `http://localhost:5173` en tu navegador
2. Inicia sesión y crea/únete a una sala
3. Cuando un jugador golpea un cono, se abrirá automáticamente el minijuego en una nueva pestaña

## 📁 Estructura

```
Bits/
├── docker-compose.yml          # Orquestación principal
├── client/                      # Cliente principal (React + Vite)
│   └── Dockerfile
├── server/                      # Servidor principal (Colyseus)
│   └── Dockerfile
└── minigames/
    └── two-keys-gate/          # Minijuego cooperativo
        ├── docker-compose.yml  # (No usado, integrado en principal)
        ├── client/
        │   └── Dockerfile
        └── server/
            └── Dockerfile
```

## 🔧 Configuración

### Variables de Entorno

El docker-compose ya está configurado con las variables necesarias. Si necesitas cambiar puertos o URLs, edita `docker-compose.yml`.

### Redes

Todos los servicios están en la red `blindrally-net` para comunicación interna.

## 🛠️ Desarrollo

### Sin Docker (desarrollo local)

**Servidor principal:**
```bash
cd server
npm install
npm run dev
```

**Cliente principal:**
```bash
cd client
npm install
npm run dev
```

**Minijuego:**
```bash
cd minigames/two-keys-gate/server
npm install
npm run dev

# En otra terminal
cd minigames/two-keys-gate/client
npm install
npm run dev -- --port 5174
```

## 🎮 Flujo del Minijuego

1. El driver golpea un cono
2. Se abre una nueva pestaña con el minijuego para ambos jugadores (driver y navigator)
3. Los jugadores completan el minijuego cooperativo
4. Al terminar (ganar o perder), el minijuego llama a `/minigame/result` con `{"won": true/false, "roomCode": "ABCD"}`
5. El servidor aplica las recompensas y el juego continúa

## 📝 Notas

- El minijuego obtiene el `roomCode` de los parámetros de la URL
- El minijuego se comunica con el servidor principal en el puerto 2567
- El minijuego tiene su propio servidor en el puerto 3001 para la lógica del juego
- Los servicios se comunican a través de la red Docker `blindrally-net`

