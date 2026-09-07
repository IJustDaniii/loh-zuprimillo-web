# Modelo de amenazas resumido

Activos: contenido privado, objetos R2, credenciales, sesiones, ubicaciones y poderes de Dani.

Fronteras: navegador→Worker, Worker→D1/R2, usuario→contenido de otro usuario y miembro→administración.

- Suplantación: tokens aleatorios hasheados en D1, cookie HttpOnly/Secure/SameSite, contraseña PBKDF2 con sal única, invitación de un uso.
- Manipulación: Zod y SQL parametrizado; comprobación de propietario o rol en cada mutación.
- Repudio: `audit_log` para accesos y acciones administrativas.
- Divulgación: Worker antes que assets, bucket privado, respuestas `private, no-store`, CSP, `noindex`, referencias opacas.
- Denegación: límites de tamaño/tipo, paginación y bloqueo temporal de intentos de login.
- Elevación: rol leído de D1 en cada sesión; rutas admin protegidas en servidor.

Riesgo residual inevitable: un miembro autorizado puede hacer capturas, grabar la pantalla o fotografiarla. La aplicación disuade la extracción casual, no afirma impedirla.
