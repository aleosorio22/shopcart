# ShopCart

Plataforma de ventas: base de datos SQL Server, API en Node.js con TypeScript y frontend en React.

| Carpeta | Contenido | Estado |
|---|---|---|
| `database/` | Scripts numerados, documento de diseño y diagrama ER | Escrito; pendiente de ejecutar en SQL Server |
| `backend/` | API REST, monolito modular | Compila y pasa sus pruebas sin base de datos |
| `frontend/` | Aplicación React | Fase 2 |

## Instalación

Requisitos: Node.js 24 y SQL Server 2019 o superior.

1. Crea la base siguiendo la sección 7 de [database/docs/Diseno_BD.md](database/docs/Diseno_BD.md).
2. Configura e inicia el API:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Completa `.env`: las contraseñas de `shopcart_api` y `shopcart_jobs`, y `JWT_SECRET`, que puedes generar con `openssl rand -base64 48`. El API no arranca si falta un valor.

- Documentación interactiva: `http://localhost:3000/api/docs`
- Pruebas: `npm test`
- Verificación completa: `npm run typecheck && npm run lint && npm run build`

## Credenciales de prueba

Contraseña de todos: `ShopCart#2026`. Solo existen en los datos semilla.

| Usuario | Rol |
|---|---|
| `admin@shopcart.test` | Administrador |
| `operador@shopcart.test` | Operador |
| `cliente1@shopcart.test` | Cliente |

Tarjeta simulada: cualquier `tokenPago` se aprueba, y `tok_rechazada` se rechaza.

## Arquitectura

Monolito modular con arquitectura hexagonal. Cada módulo de `backend/src/modules` tiene cuatro capas:

| Capa | Responsabilidad |
|---|---|
| `domain` | Reglas de entrada, tipos y puertos (interfaces). No conoce Express ni SQL Server |
| `application` | Casos de uso. Dependen solo de puertos |
| `infrastructure` | Adaptadores: stored procedures, bcrypt, JWT, pasarela |
| `http` | Rutas: validan y delegan, sin lógica de negocio |

`src/composition.ts` es el único lugar que conoce las implementaciones concretas.

**SOLID en el código:**
- Responsabilidad única: cada capa cambia por un solo motivo.
- Abierto/cerrado: una pasarela real se agrega implementando `PasarelaPago`.
- Sustitución de Liskov: `SqlFalso` reemplaza a `MssqlGateway` en las pruebas.
- Segregación de interfaces: cada módulo tiene su propio puerto.
- Inversión de dependencias: los servicios reciben interfaces por constructor.

**Una ruta, una definición.** `ruta({...})` crea el endpoint, su validación, su control de acceso y su documentación OpenAPI, así la documentación no se desalinea.

## Seguridad y autenticación

| Tema | Decisión |
|---|---|
| Contraseñas | bcrypt con costo 12 y política de 10 caracteres con letras y números |
| Access token | JWT de 15 minutos. Algoritmo, emisor y audiencia fijos al verificar |
| Refresh token | Opaco, de 256 bits. En BD solo su SHA-256. Viaja en cookie `HttpOnly`, `Secure`, `SameSite=Strict` |
| Rotación | Cada uso emite otro. Reutilizar uno ya rotado revoca toda la familia |
| Fuerza bruta | Bloqueo por cuenta tras 5 intentos, y límite de peticiones por IP |
| Enumeración | Mismo mensaje y mismo costo de CPU si el correo no existe |
| Clientes y personal | Misma tabla, con rol y permisos. Los permisos se cargan de la BD, no del token, y un usuario desactivado cae de inmediato |
| Autorización | Doble: en la ruta y otra vez dentro de cada SP |
| Aislamiento | El usuario sale del JWT. El carrito se deduce de la sesión. Un pedido ajeno responde 404 |
| CSRF | `SameSite` y rechazo de escrituras desde orígenes no permitidos |
| SQL injection | No hay SQL en el código; una prueba lo verifica. El login del API solo puede ejecutar el esquema `Api` |
| Pagos | Solo se recibe un token de pasarela, nunca datos de tarjeta |

## Idempotencia

`POST /checkout` y `POST /checkout/:id/pagar` exigen la cabecera `Idempotency-Key` con un UUID. La llave de cobro es el checkout, no la petición: dos clics, dos pestañas o un reintento de red producen un solo cobro y un solo pedido.

## Convenciones del API

- Correcto: `{ success, data, meta? }`.
- Error: `{ success: false, error: { codigo, mensaje, detalles?, requestId } }`.
- Los campos de respuesta conservan el nombre de las columnas, como `IDPedido`. Los `BIGINT` llegan como texto para no perder precisión.

## Decisiones técnicas

- **Sin ORM:** lo exige el enunciado. `SqlGateway` solo permite invocar procedimientos con parámetros tipados.
- **zod:** validación y tipos desde una sola fuente.
- **pino:** logs estructurados que ocultan `Authorization` y cookies.
- **Tareas programadas en el backend:** funcionan también en SQL Server Express, que no trae SQL Agent.
- **Reintento de deadlocks:** hasta tres intentos, porque el motor ya hizo rollback completo.
- **Límite de peticiones en memoria:** suficiente para una instancia. Con varias instancias debe pasar a Redis.
- **Caché de permisos de 30 segundos:** desactivar a un usuario la invalida al instante en esta instancia.

Las decisiones de negocio y el diagrama de estados están en [Diseno_BD.md](database/docs/Diseno_BD.md). El diagrama entidad-relación está en [database/docs/er](database/docs/er).

## Limitaciones conocidas

- La pasarela es simulada y guarda sus cobros en memoria. Una real debe aplicar la misma llave.
- Los SP no reciben la IP, así que `Bitacora.DireccionIP` queda vacía.
