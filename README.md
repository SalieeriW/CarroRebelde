# 🚗 Coche Rebelde 3D

Juego cooperativo multijugador en tiempo real diseñado para enseñar cooperación a través del caos, la risa y la comunicación asimétrica.

## 🎮 Concepto

Un coche 3D avanza continuamente por una pista. **No hay freno**. El coche no puede ser conducido por una sola persona. La única forma de avanzar es cooperar, integrando información parcial, señales sonoras y comunicación verbal.

## 👥 Roles Asimétricos (4 Jugadores)

### 1️⃣ CONDUCTOR (Dirección)
- **Controla**: Izquierda / Derecha (← → o A/D)
- ❌ NO ve el camino
- ❌ NO ve trampas
- Ve solo el coche y entorno borroso
- ✅ Puede hablar

### 2️⃣ ACELERADOR
- **Controla**: Acelerar (↑ o W/Espacio)
- ❌ NO ve el camino
- ❌ NO ve trampas
- Ve solo un velocímetro exagerado
- ✅ Puede hablar

### 3️⃣ COPILOTO / CLAXON (ROL CLAVE)
- ❌ NO puede hablar
- **Controla**:
  - 📣 Claxon (H)
  - 📻 Cambiar la radio (R)
- 👀 VE LAS TRAMPAS
- ❌ NO ve el mapa
- El copiloto es el único que conoce los peligros inmediatos, pero solo puede comunicarlo mediante sonidos.

### 4️⃣ NAVEGADOR (MAPA)
- ❌ NO controla el coche
- ❌ NO ve trampas
- ✅ VE TODO EL MAPA
- Da instrucciones verbales
- Decide la ruta correcta

## 🚧 Trampas

Solo visibles para el copiloto:
- 🦔 **Pinchos** → Controles invertidos 5s
- 💧 **Charco** → Derrape exagerado
- 🌪️ **Zona mareo** → Cámara loca
- 📻 **Zona radio** → Sonidos absurdos

## ✏️ Challenge: Draw & Guess en Cadena

Durante el recorrido aparecen portales de challenge.

**Flujo**:
1. El sistema elige una palabra aleatoria segura
2. **Dibujante 1** ve la palabra y dibuja (10-12s)
3. **Dibujante 2** ve solo el dibujo anterior y vuelve a dibujar
4. **Adivinador** ve el último dibujo y tiene 1 intento

**Resultado**:
- ✅ **Acierto** → TURBO (velocidad x2, partículas, sonido épico)
- ❌ **Fallo** → PENALIZACIÓN (controles invertidos, cámara loca, radio absurda)

## 🛠️ Stack Tecnológico

### Frontend
- React + Vite
- Three.js (renderizado 3D)
- HTML5 Canvas 2D (sistema de dibujo)
- Web Audio API (sonidos)

### Backend
- Colyseus (Node.js + TypeScript)
- Servidor autoritativo
- Salas (rooms) multijugador

## 🚀 Instalación y Ejecución

### Prerrequisitos
- Node.js 18+ 
- npm o yarn

### 1. Instalar dependencias

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Ejecutar el servidor

```bash
cd server
npm run dev
```

El servidor se ejecutará en `ws://localhost:2567`

### 3. Ejecutar el cliente

En otra terminal:

```bash
cd client
npm run dev
```

El cliente se abrirá en `http://localhost:5173`

### 4. Jugar

1. Abre 4 pestañas/navegadores diferentes (o comparte el enlace con otros jugadores)
2. Cada jugador se conectará automáticamente y recibirá un rol
3. Cuando haya al menos 2 jugadores, se puede iniciar el juego
4. ¡Disfruta del caos cooperativo!

## 🎯 Características Implementadas

- ✅ Sistema de roles asimétricos
- ✅ Renderizado 3D con Three.js
- ✅ Sistema de trampas visibles solo para copiloto
- ✅ Sistema de challenges (draw & guess en cadena)
- ✅ Web Audio API para sonidos (claxon, radio, efectos)
- ✅ Sistema de penalizaciones y turbo
- ✅ Sincronización multijugador en tiempo real
- ✅ Interfaz adaptada por rol
- ✅ Sistema de dibujo con Canvas 2D

## 📝 Notas para Hackatón

Este es un MVP funcional para un hackatón de 1 día. Características adicionales que se podrían añadir:

- Rotación automática de roles después de cada challenge
- Más tipos de trampas
- Sistema de puntuación cooperativa
- Más palabras para los challenges
- Mejoras visuales (partículas, efectos)
- Sonidos más elaborados
- Sistema de chat de voz integrado

## 🎨 Principios de Diseño

- **Nadie tiene toda la información**
- **Nadie puede ganar solo**
- **El error es colectivo**
- **La cooperación es obligatoria**
- **La comunicación no verbal importa**

## 📄 Licencia

Proyecto desarrollado para hackatón educativo.

