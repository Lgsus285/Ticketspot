# Panel administrativo de Ticketspot

## Qué se agregó
- `admin.html`: interfaz del panel.
- `js/admin.js`: autenticación/validación de rol, indicadores, eventos y últimas ventas.
- Estilos del panel al final de `style.css`.
- `supabase/admin_setup.sql`: políticas RLS y asignación del rol administrador.

## Configuración obligatoria en Supabase
1. Abre Supabase > SQL Editor.
2. Asegúrate de haber ejecutado primero `supabase/schema.sql`.
3. Abre `supabase/admin_setup.sql` y reemplaza `TU_CORREO_ADMIN@EJEMPLO.COM` por el correo real de tu cuenta registrada en Supabase Auth.
4. Ejecuta el archivo completo. Comprueba que el `UPDATE` indique `UPDATE 1`. Si indica `UPDATE 0`, el correo no coincide con un usuario registrado.
5. Cierra sesión y vuelve a ingresar para que Supabase emita un JWT nuevo con `app_metadata.role = admin`.
6. Abre `admin.html`.

El rol se guarda en `app_metadata`, no en `user_metadata`: un usuario normal no debe poder asignarse a sí mismo el rol de administrador desde el navegador. No compartas la llave `service_role` en archivos frontend.

## Funcionalidades actuales
- Indicadores de eventos, ventas, boletos vendidos e ingresos simulados.
- Crear, editar, buscar y eliminar eventos.
- Tabla de últimas 100 compras.
- Acceso bloqueado para usuarios sin rol de administrador.
- Las operaciones administrativas también están protegidas por Row Level Security en Supabase.

## Consideraciones
- Los ingresos corresponden a compras simuladas de este proyecto; no son cobros reales.
- La eliminación de eventos con compras relacionadas puede ser rechazada por la clave foránea de la base de datos. En ese caso, conserva el evento y edítalo en lugar de eliminarlo.
- El panel no incluye todavía administración de cuentas de usuarios de Auth: esa operación requiere un backend confiable o una Edge Function con privilegios administrativos, nunca la llave `service_role` en el navegador.
- Las estadísticas de ventas se calculan sobre las últimas 100 compras recuperadas para la tabla; si el proyecto crece, conviene crear una vista o función SQL agregada para obtener totales históricos completos.
