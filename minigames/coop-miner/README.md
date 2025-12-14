# Coop Miner (Golden Miner · Cooperativo)

> Nueva rama de minijuego, siguiendo el patrón de `two-keys-gate`: A/B cooperan, API REST con estado en memoria, sesión corta, sin ranking ni castigos.

## Concepto rápido
- Jugador A (Operador): controla el gancho; ve solo los objetos.
- Jugador B (Estratega): ve valores/pesos/special; aconseja qué minar.
- Objetivo por nivel: alcanzar una meta de puntos en tiempo flexible (barra de progreso, no timer duro).
- 3 niveles en secuencia; tras el último, fin y retorno a mainboard.
- Responsable: sin PvP, sin penalizaciones duras; “no cumplido” = reintentar.

## Estado/API (heredable de two-keys-gate)
- GET `/rooms/:code` → state (levelId, goalScore, score, objects, hook?, winner?, chat, players, totalLevels).
- POST `/claim|release|ready|start` → asientos/ready/start.
- POST `/action/hook {angle?, targetId?}` → A dispara.
- POST `/action/target {targetId}` → B marca/ayuda (opcional).
- POST `/action/chat {text}`
- POST `/reset`
- State extra: `objects[{id,type,icon,value,weight,size,special,x,y,taken}]`, `goalScore`, `score`, `winner: null|success|retry`, `totalLevels`.

## Niveles (versión inicial)
1) Bosque (150 pts): Piedra 8 grande pesada; Cristal 25 medio; Cofre 50 pequeño pesado ±10; Hongo 15 medio ligero.
2) Cinturón estelar (200 pts): Meteorito -10 grande muy pesado slow; Núcleo 20 medio ligero; Diamante 60 pequeño muy pesado; Plasma 10 pequeño buff speed; Fragmento 15 medio ligero.
3) Mina de dulces (180 pts): Paleta 15 grande ligera; Arcoíris 25 medio ligera combo+5; Chocolate 40 pequeño pesado; Gelatina 10 grande media next+5; Caja 50 pequeña pesada.

## Frontend
- React + Phaser 3 (escena única): render mapa/objetos/gancho; overlay UI (rol A controles, rol B tabla de valores + chat, barra de progreso).
- Pixel art, colores suaves, feedback positivo; opciones/objetos pueden aleatorizar distribución y orden.

## Backend
- Express con estado en memoria (similar two-keys-gate REST)，sin DB。
- Generación aleatoria de objetos por nivel, aplicando valor/weight/size/special。
- Lógica de hit/score/cambio de nivel; niveles 1 y 2 auto avanzan, nivel 3 muestra salida.

## Next steps
- Crear `shared/minerLevels.json` con definición formal de objetos por nivel.
- Añadir servidor `coop-miner/server` y cliente `coop-miner/client` basados en la plantilla de two-keys-gate (REST hooks + polling).
- Integrar en mainboard como otro minijuego入口（无状态）。
