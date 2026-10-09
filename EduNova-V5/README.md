# EduNova V5 — paquete inicial

Plataforma educativa en español con interfaz oscura y tecnológica. Incluye autenticación con Supabase, tareas, apuntes, horario y calificaciones. Los registros se guardan en Supabase asociados a la cuenta iniciada.

## 1. Configurar Supabase
1. Abre tu proyecto de Supabase.
2. En **Project Settings → API** o **Connect**, copia el **Project URL** y la **publishable key** (o la clave pública `anon`).
3. Abre `supabase.js` y reemplaza `PEGA_AQUI_TU_PROJECT_URL` y `PEGA_AQUI_TU_PUBLISHABLE_O_ANON_KEY`.
4. Nunca pongas una clave `service_role` o secreta en archivos del navegador.

## 2. Tablas y seguridad
`database/schema.sql` crea `tasks`, `notes`, `schedule_items` y `grades`, activa RLS y crea políticas por usuario.
- Si todavía no creaste las tablas, abre el SQL Editor de Supabase, pega el archivo y ejecútalo.
- Si ya existen, revisa que coincidan los nombres y columnas antes de ejecutar. No reemplaces tablas existentes sin revisar y tener respaldo.

## 3. Probar la web
Usa un servidor estático, como Live Server en Visual Studio Code. Abrir `index.html` directamente puede dar problemas; un servidor local suele ser más fiable. Necesita internet para cargar Supabase.

## 4. Subir a GitHub
1. Descomprime el ZIP.
2. Abre tu repositorio `EduNova-V5` en GitHub.
3. Pulsa **Add file → Upload files**.
4. Sube el contenido de la carpeta `EduNova-V5` (no hace falta subir la carpeta ZIP).
5. Confirma el cambio con **Commit changes**.

Para publicar la web, entra a **Settings → Pages** y selecciona la rama y carpeta donde esté `index.html`.

## 5. Pruebas recomendadas
- Crear una cuenta e iniciar sesión.
- Crear una tarea, completarla y recargar la página.
- Guardar un apunte, una actividad y una calificación.
- Cerrar sesión y volver a entrar para verificar que los datos persisten.

## Alcance de esta entrega
Esta es una base inicial. Cursos completos, búsqueda global, filtros avanzados, calendario mensual, recordatorios, exportaciones, copias de seguridad avanzadas y el asistente de IA necesitan desarrollo adicional. La IA debe conectarse mediante un backend seguro, nunca exponiendo claves secretas en el navegador.
