# Corrección de Gestionar conexión — 4/oct/2026

La captura real de iPhone mostró título duplicado, formulario de cuenta siempre expandido, párrafos redundantes, diagnóstico antes de acciones y footer vacío. Se corrige el panel interior, no sólo su envoltorio.

Cuenta actual y Cambiar; actualización con período explícito y última fecha en Argentina; selector de período y diagnóstico plegados. Cambio de cuenta conserva PUT/versionamiento y sólo se abre por acción explícita. Consulta mantiene endpoint/payload/rangos. No hay migraciones, cambios financieros ni activación automática.

TaskSurface permite ocultar intro en esta pantalla y no reserva footer cuando es null. El título de navegación conserva labelledBy del diálogo. Otros TaskSurface mantienen intro por defecto.

Handoff para Hermes: trabajo directo sin delegación; base main 5ccedeb; rama fix/mercadopago-manage-design. Artefactos: Settings, TaskSurface, galería ficticia gestión. Supuesto: endpoint manual sigue siendo la fuente de actualización. Riesgos: captura real conectada requiere sesión; galería no consulta ni registra. Verificación y estado de Preview en PR de entrega. Pendientes: despliegue de esta corrección tras revisión.
