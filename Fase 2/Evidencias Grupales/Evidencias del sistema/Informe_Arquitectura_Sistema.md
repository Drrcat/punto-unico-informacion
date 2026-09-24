# Informe Técnico de Arquitectura del Sistema
## Tótem Interactivo de Orientación Estudiantil (Punto Único de Información)

**Documento preparado para:** Reunión de definición técnica con profesor guía
**Propósito:** Establecer de forma definitiva la arquitectura, el stack tecnológico, la metodología de trabajo y los artefactos exigidos por la pauta de la asignatura, de manera que sirvan de base formal para el desarrollo del proyecto.

---

## 1. Alcance del sistema

De acuerdo con los requisitos de la asignatura, el proyecto no se limita a una única aplicación, sino que debe considerar un sistema compuesto por tres partes que operan de forma coordinada: una aplicación web orientada al estudiante, una aplicación de escritorio orientada a la administración de esa misma aplicación web, y una base de datos relacional que sirve de soporte a ambas. Adicionalmente, el sistema debe exponer un mínimo de cinco APIs, de las cuales al menos dos deben ser de desarrollo propio, pudiendo complementarse con servicios públicos externos.

La aplicación web corresponde al tótem físico instalado en el campus, ejecutado en modo kiosco sobre el equipo Dell OptiPlex 3000 Micro ya validado. La aplicación de escritorio corresponde a un panel administrativo, separado del tótem, mediante el cual el personal autorizado de Duoc UC podrá gestionar la información que la aplicación web consume: salas, coordinadores de carrera, contenidos de preguntas frecuentes, y el seguimiento de solicitudes de enrolamiento fotográfico. Ambas aplicaciones se apoyan en el mismo backend y en la misma base de datos, evitando la duplicación de lógica de negocio.

---

## 2. Arquitectura general propuesta

El sistema se organiza en cuatro capas claramente diferenciadas: dos frontends (web y escritorio), un backend único que centraliza la lógica de negocio y las cinco APIs, y una base de datos relacional.

La aplicación web se construye con HTML, JavaScript y Three.js para el componente de mapa interactivo tridimensional, ejecutándose en modo kiosco sobre Chrome o Edge. Esta decisión ya fue validada con un prototipo funcional que demostró un rendimiento fluido en el hardware disponible, incluyendo renderizado 3D, rotación de cámara táctil y detección de interacción sobre las salas.

La aplicación de escritorio administrativa se construye con **Electron**, lo que permite reutilizar HTML, CSS y JavaScript —la misma base tecnológica del tótem— empaquetados como una aplicación instalable en el computador de un funcionario, sin necesidad de aprender un framework de escritorio distinto. Electron se conecta al mismo backend que consume la aplicación web, mediante las mismas APIs REST, diferenciándose únicamente en los permisos habilitados: mientras el tótem solo puede leer información pública y ejecutar acciones puntuales (consulta de salas, enrolamiento), la aplicación de escritorio requiere autenticación de personal autorizado y habilita operaciones de creación, edición y eliminación sobre las tablas administrables.

El backend se centraliza en **Node.js**, utilizando el framework **NestJS** y el lenguaje **TypeScript**. Esta decisión responde a que Node.js permite mantener un único lenguaje de programación a lo largo de todo el proyecto —JavaScript o TypeScript tanto en el frontend web, en la aplicación de escritorio Electron, como en el backend—, reduciendo la curva de aprendizaje total y el riesgo de errores de integración entre capas. TypeScript añade tipado estático, lo que resulta especialmente valioso dado el volumen de datos que maneja el sistema (30 tablas, 5 APIs), al detectar errores de forma anticipada durante el desarrollo. NestJS, por su parte, impone una estructura de proyecto ordenada (módulos, controladores, servicios), evitando que el código se vuelva difícil de mantener a medida que crece.

Como alternativa evaluada y descartada por mayor complejidad de configuración inicial se consideró Java con Spring Boot, opción que ofrece un ecosistema de seguridad más integrado de fábrica (Spring Security) pero que introduce una curva de aprendizaje más pronunciada y un desarrollo más lento para el volumen y plazo de este proyecto. Se documenta como alternativa válida en caso de que la evaluación académica priorice un stack orientado a objetos de mayor peso curricular.

La conexión entre el backend y la base de datos se realiza mediante **Prisma** como ORM (mapeo objeto-relacional), lo que además de simplificar las consultas, previene de forma estructural los ataques de inyección SQL al generar las consultas de manera parametrizada.

La base de datos elegida es **PostgreSQL**, motor relacional robusto y de uso gratuito, adecuado para sostener el modelo de treinta tablas normalizadas ya definido, agrupadas en los dominios de Usuarios y Acceso, Académico, Infraestructura, Procesos y Trámites, y Sistema/Tótem.

---

## 3. Las cinco APIs del sistema

| API | Tipo | Función principal |
|---|---|---|
| Enrolamiento y Trámites | Propia (interna) | Gestiona el flujo de autenticación, validación fotográfica y registro de solicitudes hacia el sistema institucional de enrolamiento. |
| Infraestructura y Salas | Propia (interna) | Resuelve ubicación y equipamiento de cada sala, poblada con datos reales del archivo institucional "Mayor Equipamiento Tecnológico". |
| Preguntas Frecuentes (FAQ) | Propia (interna) | Entrega contenidos de autogestión sobre trámites y procesos comunes, administrables desde la aplicación de escritorio. |
| Microsoft Graph (Entra ID) | Pública (externa) | Verificación de identidad del alumno mediante autenticación sin contraseña, según se detalla en la sección 4. |
| Google Vision AI | Pública (externa) | Validación facial de la fotografía capturada durante el proceso de enrolamiento, previo a su envío al sistema institucional. |

Con esta distribución, el sistema cumple holgadamente el mínimo exigido de dos APIs propias, disponiendo de tres, y complementa con dos servicios públicos externos correctamente justificados.

Queda pendiente de aprobación por parte de la jefatura de carrera la incorporación de una sexta capacidad —consulta de horario del alumno—, la cual, de ser aprobada, no requeriría rediseño de la base de datos, dado que las tablas `alumnos`, `secciones` y `horarios` ya contempladas en el modelo de treinta tablas cubren dicha funcionalidad; solo implicaría exponer un endpoint adicional sobre datos ya modelados.

---

## 4. Módulo de autenticación e identidad

Uno de los puntos que requería mayor definición era cómo validar que la persona frente al tótem es efectivamente un alumno de Duoc UC, sin que el proyecto deba mantener una copia propia y desactualizada de la base de alumnos de la institución. La solución adoptada delega esa verificación en **Microsoft Entra ID**, sistema de identidad que Duoc UC ya utiliza de forma institucional para las cuentas de correo y las plataformas de Microsoft 365.

El mecanismo elegido es la autenticación sin contraseña (*passwordless*): el alumno ingresa únicamente su correo institucional en el tótem, tras lo cual el backend, mediante la librería MSAL y Microsoft Graph API, dispara una notificación push a la aplicación Microsoft Authenticator que el alumno ya tiene asociada a su cuenta. El alumno confirma su identidad con un toque en su teléfono, sin necesidad de escribir contraseña ni código alguno en el tótem. Este mecanismo reduce el tiempo de autenticación a aproximadamente diez segundos y evita que el sistema del tótem maneje o almacene contraseñas en ningún momento del proceso.

No todas las funciones del sistema exigen este nivel de verificación. Se aplica un esquema de autenticación proporcional al riesgo de cada acción: la consulta del mapa de salas, el directorio de coordinadores y las preguntas frecuentes permanecen abiertas sin autenticación, por tratarse de información pública; la consulta del horario personal requiere solo una identificación rápida mediante el código de barras de la aplicación Vivo Duoc; y la acción sensible e irreversible —el enrolamiento fotográfico— exige la verificación fuerte descrita anteriormente.

Para la implementación de esta integración se requiere que el área de TI de Duoc UC habilite un registro de aplicación (*App Registration*) en su tenant de Microsoft Entra, otorgando al backend del tótem un identificador de aplicación y permisos acotados de solo lectura sobre el perfil básico del usuario autenticado. Mientras dicho acceso institucional se formaliza, el equipo del proyecto cuenta con una versión simulada de este flujo —desarrollada en Node.js y TypeScript— que replica exactamente el mismo contrato de datos y la misma secuencia de pasos, permitiendo demostrar el funcionamiento completo del sistema sin depender de las credenciales de producción.

---

## 5. Módulo de enrolamiento fotográfico

El sistema `clickvisitas.duoc.cl`, utilizado actualmente para el enrolamiento fotográfico de alumnos, no dispone de una API pública oficial, y el único acceso disponible corresponde a una cuenta de administrador con visibilidad y capacidad de modificación sobre todos los usuarios registrados. Exponer dicho acceso directamente en el tótem representa un riesgo de seguridad inaceptable, motivo por el cual se descarta cualquier integración directa desde el frontend.

La solución adoptada consiste en que el backend propio actúe como intermediario: las credenciales administrativas del sistema institucional permanecen exclusivamente en el servidor, nunca se exponen al tótem ni al alumno, y la acción ejecutada se restringe estrictamente a la carga de una fotografía asociada a un único alumno por solicitud, sin exponer funciones de listado, edición o eliminación de otros registros. Dado que no existe una API oficial, la ejecución de esta acción puntual se realiza mediante automatización de navegador en el servidor (Playwright), replicando de forma acotada y auditable el mismo procedimiento que ejecutaría manualmente un administrador.

Previo al envío hacia el sistema institucional, la fotografía capturada es validada mediante Google Vision AI, verificando la presencia de un único rostro, buena iluminación y encuadre adecuado. Esta validación evita que fotografías inválidas lleguen a consumir intentos contra el sistema real y mejora la experiencia del alumno, al entregarle retroalimentación inmediata en pantalla.

---

## 6. Infraestructura de hardware confirmada

El equipo integrado físicamente al tótem corresponde a un Dell OptiPlex 3000 Micro, cuyas especificaciones fueron verificadas directamente sobre el equipo:

| Componente | Detalle |
|---|---|
| Procesador | Intel Core i5, 12ª generación |
| Memoria RAM | 16 GB (15,7 GB usables) |
| Almacenamiento | SSD NVMe PCIe Gen4 x4, 1 TB |
| Conectividad inalámbrica | Intel Wi-Fi 6E (AX210NGW) con Bluetooth integrado |
| Red cableada | Ethernet integrado |
| Sistema operativo | Windows, 64 bits |
| Periféricos | Pantalla táctil integrada (respuesta fluida verificada), cámara web externa USB |

Con estas características, el equipo no representa una limitante para ninguna de las cargas de trabajo previstas, incluyendo el renderizado tridimensional en tiempo real, ya validado mediante prototipo.

---

## 7. Contenerización y despliegue (Docker)

Conforme a lo exigido por la pauta de la asignatura, el despliegue del sistema se documentará y ejecutará mediante contenedores Docker. Se contempla un `Dockerfile` para el backend NestJS, un segundo contenedor para el motor PostgreSQL, y un archivo `docker-compose.yml` que orquesta ambos servicios junto con las variables de entorno necesarias (cadena de conexión a base de datos, credenciales de las APIs externas, puertos expuestos). El archivo `README.md` del repositorio incluirá las instrucciones exactas para levantar el sistema completo en un entorno local mediante `docker-compose up`, sin requerir configuración manual adicional.

---

## 8. Requisitos no funcionales

**Seguridad.** El sistema no almacena ni transmite contraseñas de alumnos; la verificación de identidad se delega íntegramente en Microsoft Entra ID. Las credenciales administrativas del sistema de enrolamiento permanecen exclusivamente en el backend. Las consultas a la base de datos se ejecutan mediante Prisma, lo que previene inyección SQL. Las contraseñas del personal administrativo, en caso de existir un esquema de autenticación local para la aplicación de escritorio, se almacenan cifradas mediante bcrypt.

**Rendimiento.** Dado el bajo volumen de transacciones concurrentes esperado por tótem (uso individual, no simultáneo), el hardware disponible resulta ampliamente suficiente. El módulo de mapa 3D fue validado con geometría de bajo nivel de detalle (*low-poly*), manteniendo el rendimiento fluido incluso con múltiples salas renderizadas.

**Escalabilidad.** La arquitectura desacoplada entre frontend y backend permite que, en caso de instalarse el sistema en múltiples sedes o pisos, cada tótem consuma el mismo backend centralizado sin duplicar lógica, cargando únicamente los datos correspondientes al piso o sede que se está consultando en cada momento.

**Disponibilidad.** Se contempla el registro de errores y solicitudes fallidas en tablas propias del sistema, permitiendo trazabilidad ante fallos puntuales de los servicios externos (Google Vision, Microsoft Graph), sin que dichos fallos bloqueen la disponibilidad de las funciones no dependientes de esos servicios (mapa, directorio, preguntas frecuentes).

**Portabilidad.** La contenerización mediante Docker, descrita en la sección anterior, garantiza que el sistema pueda desplegarse en distintos entornos sin depender de una configuración manual específica del equipo host.

---

## 9. Estrategia de pruebas

Se contempla la ejecución de pruebas unitarias sobre los servicios del backend (validación de reglas de negocio de cada API de forma aislada), pruebas de integración sobre los flujos completos que involucran base de datos y servicios externos (por ejemplo, el flujo completo de enrolamiento desde la autenticación hasta la validación fotográfica), pruebas de rendimiento sobre el módulo de mapa 3D y las consultas más frecuentes de la base de datos, y pruebas de seguridad orientadas a verificar que las rutas administrativas de la aplicación de escritorio no sean accesibles desde la aplicación web del tótem.

---

## 10. Diagramas UML a desarrollar

Conforme a lo exigido, se elaborarán los siguientes diagramas como parte de la documentación formal del proyecto: diagrama de casos de uso, representando las interacciones del alumno con el tótem y del personal administrativo con la aplicación de escritorio; diagrama de clases, correspondiente a las entidades principales del backend; diagrama de secuencia de la funcionalidad principal, para el cual se propone documentar el flujo de enrolamiento fotográfico por ser el de mayor complejidad técnica e integración de servicios; y diagrama de componentes, representando la relación entre frontend web, aplicación de escritorio, backend, base de datos y servicios externos.

---

## 11. Metodología de trabajo

Se mantiene la adopción de **Scrumban**, combinación de Scrum y Kanban ya validada en la reunión anterior. Su correspondencia con los artefactos exigidos por la pauta de la asignatura, bajo el enfoque ágil, se resume a continuación:

| Aspecto a evidenciar | Artefacto ágil correspondiente |
|---|---|
| Comprensión del problema | Product Vision y Product Backlog |
| Necesidades del sistema | Historias de usuario |
| Restricciones del sistema | Documento de requisitos no funcionales (sección 8 de este informe) |
| Diseño de la solución | Documento de diseño con decisiones técnicas (presente informe) |
| Planificación | Sprint Backlog y tablero Kanban |
| Validación | Criterios de aceptación y pruebas (sección 9) |
| Despliegue | Manual técnico, apoyado en la contenerización Docker |

---

## 12. Innovación

**Problema que resuelve.** La fragmentación de la información institucional obliga a los estudiantes a desplazarse físicamente entre distintas oficinas para resolver trámites de baja complejidad, y a depender de la orientación presencial para ubicarse dentro del campus, lo que genera pérdida de tiempo tanto para el alumno como para el personal administrativo.

**Qué hace diferente a la solución.** A diferencia de un punto de información tradicional, el sistema integra en un mismo dispositivo físico la orientación espacial mediante un mapa tridimensional interactivo, la autogestión de trámites reales (enrolamiento fotográfico) sin intervención de un funcionario, y una capa de seguridad de nivel institucional (autenticación sin contraseña vía Microsoft Entra ID) que no compromete la velocidad de uso.

**Qué valor agrega.** Reduce la carga operativa de las oficinas de atención al automatizar consultas y trámites recurrentes, disminuye los tiempos de espera del alumno, y sienta las bases de una arquitectura reutilizable: el mismo backend y la misma base de datos podrían escalar a múltiples tótems distribuidos en distintas sedes sin duplicar el desarrollo.

---

## 13. Estructura del repositorio y evidencia en GitHub

Conforme a lo exigido por la asignatura, el repositorio se mantendrá público desde el inicio del proyecto, con la nomenclatura de archivos indicada en la pauta (apellido y nombre en mayúsculas, sin tildes) y la siguiente estructura general:

```
totem-orientacion/
├── frontend-web/              (aplicación del tótem)
├── frontend-desktop/          (aplicación Electron de administración)
├── backend/                   (NestJS + TypeScript, las 5 APIs)
├── database/                  (esquema Prisma, scripts de carga inicial)
├── docker/                    (Dockerfile, docker-compose.yml)
├── docs/
│   ├── diagramas-uml/
│   ├── requisitos-no-funcionales.md
│   ├── plan-de-pruebas.md
│   └── informe-arquitectura.md   (este documento)
└── README.md
```

El archivo `README.md` incluirá, como mínimo, el nombre del proyecto, su descripción y problema que resuelve, las tecnologías utilizadas, las instrucciones de ejecución local mediante Docker, los integrantes del equipo con sus roles, la metodología de trabajo adoptada y una descripción de la arquitectura de la solución.

---

## 14. Calendario de trabajo (8 semanas)

El proyecto cuenta con un plazo de dos meses, lo que equivale aproximadamente a ocho semanas de trabajo efectivo. Sobre esa base, los sprints definidos en la sección de metodología se distribuyen de la siguiente manera:

| Semana | Sprint | Objetivo |
|---|---|---|
| 1 | Sprint 0 (cierre) | Arquitectura, hardware y stack ya definidos en el presente informe; puesta en marcha del repositorio. |
| 2 – 3 | Sprint 1 | Diseño final de las treinta tablas, esquema Prisma, definición formal de los endpoints de las tres APIs propias. |
| 4 – 5 | Sprint 2 | Módulo de mapa interactivo (trazado de planos restantes, integración Three.js con datos reales) y aplicación de escritorio (Electron, gestión de salas y FAQ). |
| 6 | Sprint 3 | Módulo de enrolamiento fotográfico: integración con Microsoft Entra ID, Google Vision AI y automatización hacia el sistema institucional. |
| 7 | Sprint 4 | Módulo de preguntas frecuentes, contenerización Docker, pruebas de integración. |
| 8 | Sprint 5 | Pulido general, pruebas de rendimiento y seguridad, elaboración de diagramas UML y documentación final, ensayo de la presentación. |

Dado lo ajustado del plazo, se prioriza dejar completamente funcionales el mapa interactivo, la base de datos y el módulo de enrolamiento —los de mayor peso técnico y ya con avances concretos—, dejando el módulo de preguntas frecuentes, de menor complejidad, hacia el cierre del calendario.

## 15. Puntos pendientes de definición en la reunión

Corresponde validar con el profesor guía la aprobación del stack tecnológico propuesto (Node.js, TypeScript, NestJS, Prisma, PostgreSQL, Electron), la incorporación formal de la aplicación de escritorio administrativa como módulo obligatorio del proyecto, y la programación de las siguientes entregas conforme al calendario de fases establecido por la asignatura (Fase 1, 2 y 3), de manera de distribuir adecuadamente la elaboración de los diagramas UML, el plan de pruebas y la contenerización Docker dentro de los sprints ya definidos.

---

*Documento preparado como base de discusión técnica para la reunión de definición de arquitectura del proyecto.*
