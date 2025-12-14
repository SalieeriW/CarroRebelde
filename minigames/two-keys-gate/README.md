# La Puerta de Dos Llaves

Juego cooperativo web para 2 jugadores que deben comunicarse para resolver puzzles de traducción de símbolos a través de 3 niveles.

## Qué es

Un juego multijugador donde cada jugador ve información diferente:
- **Jugador A**: Ve la secuencia de símbolos a traducir
- **Jugador B**: Ve el diccionario de traducción (símbolos → letras/números)

Deben comunicarse verbalmente (Discord, llamada, etc.) para traducir la secuencia correctamente y seleccionar la respuesta entre las opciones disponibles.

## Cómo ejecutar

### Con Docker Compose

```bash
cd two-keys-gate
docker compose up --build
```

Esto levanta 3 servicios:
- **Servidor API**: http://localhost:3001
- **Jugador A**: http://localhost:5174
- **Jugador B**: http://localhost:5175

Abre cada URL en una ventana/pestaña diferente y comienza a jugar.

### Sin Docker (desarrollo local)

**Servidor:**
```bash
cd two-keys-gate/server
npm install
npm run dev
```

**Cliente Jugador A:**
```bash
cd two-keys-gate/client
npm install
npm run dev -- --port 5174
```

**Cliente Jugador B (otra terminal):**
```bash
cd two-keys-gate/client
npm run dev -- --port 5175
```

## Flujo de juego

1. Cada jugador toma su asiento (A o B) y marca "Estoy listo"
2. Al pulsar "Comenzar", cuenta regresiva de 5 segundos
3. Nivel 1 → Nivel 2 → Nivel 3 (avanzan automáticamente tras completar cada uno)
4. En cada nivel:
   - A ve símbolos, B ve el diccionario
   - Se comunican para traducir
   - Seleccionan la respuesta correcta
5. Tras el nivel 3, pantalla de victoria con botón "Salir"

## Tecnologías

**Frontend:** React + Vite
**Backend:** Express + TypeScript
**Comunicación:** API REST (sin WebSockets)
**Estado:** En memoria del servidor

## Estructura

```
two-keys-gate/
├── client/          # React app (UI de jugadores)
├── server/          # Express API
├── shared/          # levelData.json (puzzles y respuestas)
└── docker-compose.yml
```
