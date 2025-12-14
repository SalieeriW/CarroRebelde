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
  "won": true,
  "roomCode": "ABCD"
}
```

O usando `sessionId`:

```json
{
  "won": false,
  "sessionId": "mg_1234567890_abc123def"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `won` | boolean | ✅ Sí | `true` si ganaron, `false` si perdieron |
| `roomCode` | string | ⚠️ Sí* | Código de 4 letras de la sala (ej: "ABCD"). Requerido si no se envía `sessionId` |
| `sessionId` | string | ⚠️ Sí* | ID de sesión del minijuego. Requerido si no se envía `roomCode` |

#### Response

**Éxito (200)**:
```json
{
  "success": true
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
  "error": "Field 'won' (boolean) is required"
}
```

O:

```json
{
  "error": "roomCode or sessionId is required"
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
async function sendMinigameResult(won) {
  const serverUrl = 'http://localhost:2567';
  
  // Obtener roomCode de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  const sessionId = urlParams.get('session');
  
  try {
    const response = await fetch(`${serverUrl}/minigame/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        won: won,
        roomCode: roomCode || undefined,
        sessionId: sessionId || undefined
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Resultado enviado');
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
// Cuando el jugador gana
sendMinigameResult(true);

// Cuando el jugador pierde
sendMinigameResult(false);
```

---

## 🧪 Testing con cURL

```bash
# Enviar resultado de victoria
curl -X POST http://localhost:2567/minigame/result \
  -H "Content-Type: application/json" \
  -d '{"won": true, "roomCode": "ABCD"}'

# Enviar resultado de derrota
curl -X POST http://localhost:2567/minigame/result \
  -H "Content-Type: application/json" \
  -d '{"won": false, "roomCode": "ABCD"}'

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

