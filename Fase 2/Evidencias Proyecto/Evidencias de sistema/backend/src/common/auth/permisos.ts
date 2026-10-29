/** Códigos de permiso que usan las rutas de esta parte del backend. Se cargan en la tabla `permiso` con la semilla. */
export const PERMISOS = {
  SALA_CREAR: 'sala.crear',
  SALA_EDITAR: 'sala.editar',
  SALA_ELIMINAR: 'sala.eliminar',
  AREA_CREAR: 'area.crear',
  AREA_EDITAR: 'area.editar',
  AREA_ELIMINAR: 'area.eliminar',
  ENROLAMIENTO_VER: 'enrolamiento.ver',
} as const;

export const DESCRIPCION_PERMISOS: Record<string, string> = {
  [PERMISOS.SALA_CREAR]: 'Crear salas, oficinas y otros espacios.',
  [PERMISOS.SALA_EDITAR]: 'Editar salas, oficinas y otros espacios.',
  [PERMISOS.SALA_ELIMINAR]: 'Eliminar salas, oficinas y otros espacios.',
  [PERMISOS.AREA_CREAR]: 'Crear áreas institucionales.',
  [PERMISOS.AREA_EDITAR]: 'Editar áreas institucionales.',
  [PERMISOS.AREA_ELIMINAR]: 'Eliminar áreas institucionales.',
  [PERMISOS.ENROLAMIENTO_VER]: 'Consultar el estado de las solicitudes de enrolamiento.',
};
