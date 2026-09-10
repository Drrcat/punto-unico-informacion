# Definición Metodológica del Proyecto
## Tótem Interactivo de Orientación Estudiantil (Punto Único de Información)

**Autor:** Pat — Estudiante Duoc UC
**Documento:** Propuesta de metodología de trabajo para etapa de desarrollo
**Fecha:** Agosto 2026

---

## 1. Contexto

El proyecto se encuentra en su fase inicial, con el alcance funcional ya definido (módulos de mapa interactivo, enrolamiento fotográfico, pago de TNE, directorio académico y consultas frecuentes) y con avances concretos en la validación técnica: hardware confirmado (Dell OptiPlex 3000 Micro, Core i5, 16GB RAM), stack tecnológico en definición (Three.js para mapas 3D, arquitectura de 5 APIs y base de datos de 30 tablas), y un primer prototipo funcional que valida el flujo completo desde el levantamiento de planos hasta la visualización interactiva.

Dado que el desarrollo ha requerido ajustes constantes sobre la marcha —cambio de hardware por limitaciones de memoria, corrección de procesos de exportación de planos, resolución de errores técnicos durante la construcción del prototipo—, se hace necesario adoptar una metodología de trabajo que permita **incorporar estos hallazgos sin comprometer el avance general del proyecto**, en lugar de un enfoque de planificación rígida y secuencial.

## 2. Metodología propuesta: Scrumban

Se propone un enfoque híbrido entre **Scrum** y **Kanban**, comúnmente denominado **Scrumban**, que combina la estructura de entregas incrementales de Scrum con la visualización continua del flujo de trabajo propia de Kanban.

### 2.1 Justificación

| Elemento | Aporte a este proyecto |
|---|---|
| **Ciclos de trabajo delimitados (Scrum)** | Permite organizar el desarrollo en incrementos funcionales claros (ej. módulo de mapa, módulo de enrolamiento), cada uno con un resultado demostrable al profesor guía. |
| **Tablero de flujo continuo (Kanban)** | Facilita visualizar el estado de tareas técnicas específicas (por ejemplo, el trazado de planos por piso, la configuración de cada API) sin forzar que todas avancen al mismo ritmo dentro de un ciclo fijo. |
| **Adaptabilidad ante hallazgos técnicos** | El proyecto ya ha demostrado requerir ajustes no anticipados (hardware, herramientas de diseño, formato de exportación de datos); esta metodología asume ese tipo de descubrimiento como parte normal del proceso, no como una desviación del plan. |
| **Compatibilidad con trabajo individual** | A diferencia de metodologías pensadas para equipos grandes (RUP, XP), Scrumban se adapta bien a un desarrollo unipersonal con revisiones periódicas de avance. |

### 2.2 Por qué no otras metodologías

- **Cascada (Waterfall):** exige requisitos fijos desde el inicio; el proyecto ya evidenció cambios de alcance técnico durante su desarrollo, lo que la hace poco práctica.
- **RUP:** su nivel de formalidad y documentación está pensado para equipos de mayor tamaño, resultando excesivo para un proyecto de título individual.
- **Design Thinking (como metodología única):** aporta en la fase de descubrimiento de necesidades, pero no entrega una estructura de desarrollo técnico incremental necesaria para esta etapa del proyecto.

## 3. Estructura de trabajo propuesta

### 3.1 Fases generales (Sprints)

| Sprint | Objetivo | Entregable esperado |
|---|---|---|
| **Sprint 0** *(completado)* | Definición de alcance, validación de hardware, elección de stack tecnológico | Documento de idea inicial, hardware operativo, prototipo de validación 3D |
| **Sprint 1** | Diseño de base de datos (30 tablas normalizadas) y definición formal de las 5 APIs | Modelo entidad-relación, documentación de endpoints |
| **Sprint 2** | Desarrollo del módulo de mapa interactivo (2D/3D) | Piso funcional completo, con navegación y selección de salas |
| **Sprint 3** | Módulo de enrolamiento fotográfico | Flujo de captura y validación de imagen operativo |
| **Sprint 4** | Módulo de pago de TNE y directorio académico | Integración de pago simulada/real, directorio funcional |
| **Sprint 5** | Módulo de consultas frecuentes (FAQ), pulido de interfaz y pruebas en el tótem físico | Sistema integrado, pruebas de usuario iniciales |

### 3.2 Tablero Kanban (flujo interno de tareas)

Dentro de cada sprint, las tareas técnicas se organizan en un tablero con estados:

**Por hacer → En proceso → En revisión → Terminado**

Esto permite, por ejemplo, que el trazado de planos por piso avance de forma independiente al desarrollo de las APIs, sin necesidad de esperar a que ambas líneas de trabajo coincidan en tiempo.

## 4. Herramientas de apoyo

- **Gestión de tareas:** Trello o Notion (tablero Kanban visual)
- **Control de versiones:** GitHub
- **Diseño y trazado de planos:** Figma
- **Documentación técnica:** repositorio compartido con el profesor guía

## 5. Próximos pasos

1. Validar con el profesor guía la adopción formal de Scrumban como metodología de desarrollo.
2. Definir en conjunto la duración estimada de cada sprint (se sugiere 2-3 semanas por sprint, ajustable según carga académica).
3. Formalizar el backlog inicial de historias de usuario para el Sprint 1.

---

*Documento preparado como base de discusión con el profesor guía para delimitar el enfoque metodológico de la etapa de desarrollo.*
