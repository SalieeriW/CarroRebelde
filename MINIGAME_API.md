# 🎮 API de Minijuegos - Blind Rally

Este documento describe cómo integrar un servicio de minijuegos externo con el juego Blind Rally.

## 📋 Resumen del Flujo

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Driver    │     │   Servidor  │     │  Minijuego  │
│  (Cliente)  │     │   (Colyseus)│     │  (Externo)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │ Golpea cono       │                   │
       │──────────────────>│                   │
       │                   │                   │
       │ minigameActive=   │                   │
       │ true + sessionId  │                   │
       │<──────────────────│                   │
       │                   │                   │
       │ Abre pestaña      │                   │
       │ minijuego ────────────────────────────>
       │                   │                   │
       │                   │   POST /minigame/ │
       │                   │   result          │
       │                   │<──────────────────│
       │                   │                   │
       │ Rewards +         │                   │
       │ Reposicionar      │                   │
       │<──────────────────│                   │
       │                   │                   │
```

## 🔗 Endpoints

### Base URL
```
http://<SERVER_IP>:2567
```

Por defecto en desarrollo: `http://localhost:2567`

---

### 📤 POST `/minigame/result`

**Descripción**: Envía el resultado del minijuego al servidor.

**Cuando llamar**: Cuando los jugadores completen el minijuego (ganando o perdiendo).

#### Request

```http
POST /minigame/result
Content-Type: application/json
```

```json
{
  "roomCode": "ABCD",
  "won": true
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `roomCode` | string | ✅ Sí | Código de 4 letras de la sala (ej: "ABCD") |
| `won` | boolean | ✅ Sí | `true` si ganaron, `false` si perdieron |

#### Response

**Éxito (200)**:
```json
{
  "success": true,
  "result": "won"
}
```

**Error - Room no encontrada (404)**:
```json
{
  "error": "Room not found"
}
```

**Error - Parámetros faltantes (400)**:
```json
{
  "error": "roomCode or valid sessionId is required"
}
```

---

### 📊 GET `/minigame/status/:sessionId`

**Descripción**: Consulta el estado de una sesión de minijuego (opcional, para debugging).

#### Request

```http
GET /minigame/status/mg_1234567890_abc123def
```

#### Response

```json
{
  "sessionId": "mg_1234567890_abc123def",
  "roomCode": "ABCD",
  "result": "pending",
  "elapsed": 5000
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `sessionId` | string | ID único de la sesión |
| `roomCode` | string | Código de la sala |
| `result` | string | `"pending"`, `"won"`, o `"lost"` |
| `elapsed` | number | Tiempo transcurrido en ms |

---

## 🎁 Recompensas

Si los jugadores **ganan** el minijuego, reciben:

| Recompensa | Duración | Efecto |
|------------|----------|--------|
| 👁️ **Claridad** | 8 segundos | El driver puede ver toda la pista (sin niebla) |
| 🚀 **Speed Boost** | 8 segundos | +20% velocidad máxima |

Si **pierden**, no reciben recompensas pero el coche se reposiciona igualmente.

---

## 🔧 Parámetros que recibe el Minijuego

Cuando se abre la pestaña del minijuego, la URL incluye estos parámetros:

```
/minigame.html?session=<SESSION_ID>&room=<ROOM_CODE>&role=<ROLE>
```

| Parámetro | Ejemplo | Descripción |
|-----------|---------|-------------|
| `session` | `mg_1702489123456_a1b2c3` | ID único de la sesión |
| `room` | `ABCD` | Código de la sala |
| `role` | `driver` o `navigator` | Rol del jugador que abrió la pestaña |

---

## ⏱️ Tiempos

| Evento | Duración |
|--------|----------|
| Espera de resultado (dummy actual) | 3 segundos |
| Cooldown post-minijuego | 3 segundos |
| Duración de recompensas | 8 segundos |

---

## 💻 Ejemplo de Integración (JavaScript)

```javascript
// Cuando el minijuego termina
async function sendMinigameResult(roomCode, won) {
  const serverUrl = 'http://localhost:2567';
  
  try {
    const response = await fetch(`${serverUrl}/minigame/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomCode: roomCode,
        won: won
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Resultado enviado:', data.result);
      // Cerrar la ventana del minijuego
      window.close();
    } else {
      console.error('❌ Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error);
  }
}

// Ejemplo de uso
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');

// Cuando el jugador gana
sendMinigameResult(roomCode, true);

// Cuando el jugador pierde
sendMinigameResult(roomCode, false);
```

---

## 🧪 Testing con cURL

```bash
# Enviar resultado de victoria
curl -X POST http://localhost:2567/minigame/result \
  -H "Content-Type: application/json" \
  -d '{"roomCode": "ABCD", "won": true}'

# Enviar resultado de derrota
curl -X POST http://localhost:2567/minigame/result \
  -H "Content-Type: application/json" \
  -d '{"roomCode": "ABCD", "won": false}'

# Consultar estado de sesión
curl http://localhost:2567/minigame/status/mg_1234567890_abc123def
```

---

## ⚠️ Notas Importantes

1. **Ambos jugadores** (driver y navigator) abren la pestaña del minijuego simultáneamente.

2. El minijuego es **cooperativo** - ambos deben trabajar juntos.

3. Solo se necesita **una llamada** a `/minigame/result` para ambos jugadores (el servidor aplica el resultado a toda la sala).

4. El **coche está congelado** mientras el minijuego está activo - no pueden moverse hasta que se envíe el resultado.

5. Después de enviar el resultado, hay un **cooldown de 3 segundos** antes de que el juego continúe.

6. El `roomCode` se puede obtener del parámetro `room` en la URL del minijuego.

---

## 🔄 Estado Actual

⚠️ **MODO DUMMY ACTIVO**: Actualmente el servidor auto-resuelve el minijuego después de 3 segundos con 100% de victoria (para testing).

Para activar el modo real, eliminar el `setTimeout` en `GameRoom.ts` línea ~197-203.

