# Reglas de gasto en GCP

El proyecto vive de un crédito de prueba de unos **300 USD** (5,605 MXN) que
**vence el 19 de febrero de 2027**. No hay más dinero detrás: cuando el crédito
se acaba o vence, GCP detiene los recursos. Estas reglas son para que alcance
para lo que importa: las demos, las pruebas de rendimiento y validar que el
pipeline aplica de verdad.

## La regla corta

**dev se enciende para algo concreto y se destruye al terminar.** Si nadie lo va
a usar en los próximos dos días, no se queda encendido "por si acaso".

## Qué cuesta y qué no

| Acción | Cuesta |
| --- | --- |
| Abrir un PR: `terraform plan`, compuerta, comentario del veredicto | No. Solo lee la API de GCP |
| CI del repo (pruebas, Conftest, escaneo) | No. Corre en GitHub |
| dev encendido | **Sí, por hora**, aunque nadie lo use |
| Llamadas del agente a Gemini en Vertex AI | Sí, por token. Poco con los planes de ejemplo |
| Bucket de evidencia y llavero de KMS | Marginal. Sobreviven al `destroy` a propósito |

Lo que mueve la factura mientras dev está encendido, de mayor a menor:

1. **Cloud SQL `db-g1-small`.** Cobra cada hora que existe, sin capa gratuita.
   Es casi todo el gasto.
2. **Cloud NAT y su IP pública.** Por hora activa y por datos procesados.
3. **Las 2 VMs `e2-micro`.** Una entra en la capa gratuita de `us-central1`; la
   segunda no.
4. **Logs.** Están activos los de acceso a datos de todos los servicios
   (`module "logging"`). A esta escala caben en la cuota gratuita, pero un
   script que lea en bucle puede llenarla.

Los precios cambian, así que no los copio aquí: la cifra real está en
**Facturación → Informes** de la consola, filtrada por el proyecto.

## Reglas

1. **Encender con propósito.** Antes del `apply`, di en el grupo para qué es
   (demo, prueba de rendimiento, validar un cambio de infraestructura) y cuándo
   se apaga.
2. **Quien lo enciende, pide que se destruya.** Al terminar la sesión se corre
   `terraform destroy` en `infra/environments/dev`
   ([despliegue.md](despliegue.md#destruir-el-ambiente)). Hoy solo el dueño del
   proyecto tiene permiso para destruir, así que avísale.
3. **Todo por Terraform, nada a mano en la consola.** Un recurso creado a mano
   no lo borra el `destroy` y sigue cobrando sin que nadie se acuerde. Está
   prohibido crear a mano clústeres de GKE, VMs, GPUs, endpoints o
   entrenamientos de Vertex AI y bases de datos.
4. **Ningún cambio de tamaño sin decirlo en el PR.** Subir el `tier` de Cloud
   SQL, el `tipo_maquina` de las VMs, el disco o el número de instancias cambia
   el costo por hora. Va en la sección **Riesgos** del PR, con la razón.
5. **El agente solo con lo que hace falta.** Con los planes de ejemplo o los de
   un PR, nunca en un bucle ni con scripts que lo llamen repetidamente.
6. **Las pruebas de rendimiento, dentro de la subred.** iperf3 y ping entre las
   dos VMs. El tráfico hacia internet se cobra por GB.
7. **Nadie activa la cuenta completa.** El botón "Activate full account" o
   "Upgrade" convierte la prueba en una cuenta que cobra a la tarjeta cuando se
   acaba el crédito. Solo se hace por acuerdo del equipo.

## Avisos del presupuesto

El proyecto tiene un presupuesto de **1,500 MXN al mes** con avisos por correo
al 50, 80 y 100 % del gasto real. Lo creó el dueño a mano en la consola, con los
créditos sin descontar, para que los avisos lleguen aunque el crédito esté
pagando. **El presupuesto avisa, no apaga nada.**

| Aviso | Qué hacer |
| --- | --- |
| 50 % | Revisar en Facturación → Informes qué está cobrando y si quedó algo encendido |
| 80 % | Destruir dev en cuanto termine la sesión en curso; no se enciende de nuevo sin acuerdo |
| 100 % | Destruir dev ya y avisar al equipo |

## Al terminar una sesión

- [ ] `terraform destroy` en `infra/environments/dev`, o pedirlo al dueño
- [ ] En la consola, Compute Engine y Cloud SQL sin instancias
- [ ] Nada creado a mano que siga vivo
- [ ] Avisar en el grupo que dev quedó apagado

Volver a levantarlo es correr el pipeline de nuevo (Aplicar cambios). Tarda unos
10 minutos, casi todo en Cloud SQL. Si pasan más de 7 días entre el `destroy` y
el siguiente `apply`, lee antes la decisión 19 de
[decisiones.md](decisiones.md): el rol del agente necesita otro id.
