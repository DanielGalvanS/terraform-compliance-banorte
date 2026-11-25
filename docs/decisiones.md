# Bitácora de decisiones

Las elecciones que no son evidentes, y qué pasaría si se cambiaran.

## 1. La compuerta corre dentro del runner

**Decisión.** `conftest` se ejecuta en el runner de GitHub Actions, no contra un
servicio remoto.

**Por qué.** Si dependiera de la red, un servicio caído tendría dos salidas
posibles y ambas son malas: dejar pasar los cambios, o bloquear todo hasta que
alguien lo levante. Además mantiene la validación por debajo de los 5 minutos
que exige el reto.

**Si se cambiara,** habría que decidir qué hacer cuando el servicio no
responde, y la respuesta honesta —bloquear— convierte el servicio en un punto
único de fallo del equipo entero.

## 2. El apply no vuelve a planear

**Decisión.** `apply.yml` aplica el archivo de plan que pasó la compuerta, y
comprueba su huella SHA-256 antes de hacerlo.

**Por qué.** El estado de la nube pudo cambiar entre la aprobación y el
despliegue. Replanear significa aplicar algo que nadie revisó.

**Si se cambiara,** la aprobación humana dejaría de significar nada concreto:
se estaría aprobando una intención, no un conjunto de cambios.

## 3. Las etiquetas obligatorias no aplican a la red

**Decisión.** `CO-TAG-01` solo evalúa tipos que admiten etiquetas en GCP. Los
módulos `network` y `firewall` no reciben la variable de etiquetas.

**Por qué.** Las VPC, subredes, routers y gateways NAT **no exponen el campo
`labels`** en la API de GCP. Exigírselas produciría hallazgos que nadie puede
remediar, y un catálogo que grita sin razón se acaba ignorando.

## 4. `iam_member` y nunca `iam_binding`

**Decisión.** El módulo `iam` usa `google_project_iam_member`.

**Por qué.** `iam_binding` es autoritativo sobre el rol completo: aplicarlo
borra a cualquier otro miembro que lo tuviera, **incluidos los agentes de
servicio que GCP administra solo**. Es uno de los errores más caros de revertir
en IAM, y se descubre cuando algo deja de funcionar sin explicación.

## 5. El módulo `secrets` no acepta valores

**Decisión.** Crea el contenedor del secreto y su control de acceso, nunca el
contenido.

**Por qué.** Un valor declarado en Terraform acaba en el estado en texto plano
y en el historial de git. De ninguno de los dos se saca.

**Si alguien lo "mejorara"** añadiendo una variable para el valor, rompería la
convención central del reto. Está escrito en el README del módulo para que la
siguiente persona lo sepa.

## 6. El bloqueo de retención viene apagado

**Decisión.** `bloquear_retencion = false` por defecto en el módulo `logging`.

**Por qué.** Bloquear la retención es irreversible: no se acorta, no se quita, y
el bucket no se puede borrar hasta que venza el plazo de cada objeto. En dev y
qa solo estorba, y un error ahí dura lo que dure el plazo.

**Se activa en producción**, cuando Cumplimiento confirme el plazo según el
marco más estricto aplicable.

## 7. La cuenta de servicio de las VM es obligatoria

**Decisión.** El módulo `compute` exige una cuenta y una precondición impide
dejarla vacía.

**Por qué.** Sin ella GCP asigna la cuenta por defecto de Compute Engine, que
trae **rol de editor sobre el proyecto entero**. Una instancia comprometida se
convertiría en control del proyecto.

## 8. El peering de servicios privados vive en `network`

**Decisión.** No en el módulo `sql`, que es quien lo necesita.

**Por qué.** Es por VPC, no por instancia. Si lo creara la base, una segunda
instancia lo duplicaría y el despliegue fallaría.

## 9. `depends_on` no se pasa como variable

**Decisión.** El orden entre módulos se declara con `depends_on` en la llamada.

**Por qué.** El módulo `sql` llegó a tener una variable `dependencias` usada en
un `depends_on`. **Terraform lo acepta en silencio** —`validate` y `plan` pasan
sin aviso— pero no crea ninguna dependencia real. Prometía un orden que no
garantizaba, y habría aparecido como un fallo intermitente.

## 10. Las pruebas de las políticas afirman sobre su propio control

**Decisión.** Cada prueba usa `mensajes_de("CO-XX-NN")` en vez de
`count(deny)`.

**Por qué.** Todas las políticas comparten `package main`, así que un plan de
prueba dispara varias a la vez: una instancia de Cloud SQL sin etiquetas
incumple `CO-TAG-01` aunque la prueba esté ejercitando `CO-DB-01`. Contar el
total haría que **cada política nueva rompiera las pruebas de las anteriores**.

## 11. Los revisores viven en el environment de GitHub

**Decisión.** No en el archivo del workflow.

**Por qué.** Un revisor que se pudiera quitar con un commit no sería un
control. En el environment, cambiarlo requiere permisos de administración del
repositorio y queda registrado.

## 12. Las cuentas del plan y del apply son distintas

**Decisión.** `GCP_SERVICE_ACCOUNT_PLAN` es de solo lectura;
`GCP_SERVICE_ACCOUNT_APPLY` tiene escritura y solo la usa `apply.yml`.

**Por qué.** Un fallo o un abuso del workflow de validación —que corre en cada
pull request, incluidos los de forks si se permitieran— no puede modificar
nada.

## 13. `not f(objeto[clave])` no hace lo que parece

**Decisión.** Las funciones de las políticas reciben el objeto y la clave por
separado, no el valor ya resuelto.

**Por qué.** `CO-SEC-01` tenía esta condición para detectar un valor oculto:

```rego
not tiene_valor(recurso.change.after[campo])
```

Cuando la clave no existe, el argumento queda indefinido y con él toda la
expresión, así que **la negación tampoco se cumple** y la regla no dispara. No
hay error ni aviso: la política simplemente no ve el caso. Se descubrió porque
una prueba unitaria lo exigía.

La forma correcta pasa el objeto, cuyos argumentos siempre existen, y resuelve
la ausencia dentro de la función.

## 14. Los secretos se vigilan en dos capas

**Decisión.** Escaneo del repositorio con gitleaks **y** control `CO-SEC-01`
sobre el plan.

**Por qué.** gitleaks reconoce formas de token y de llave, no contraseñas
arbitrarias: `password = "una cadena larga cualquiera"` pasa sin más. Y un
valor que llega por variable nunca aparece en el código, pero sí en el plan y
en el estado. Cada capa ve lo que la otra no.

## 15. El estado de cada recurso se calcula, no se guarda

**Decisión.** La API deriva el estado del inventario de las etiquetas del
recurso y de los hallazgos abiertos sobre él.

**Por qué.** Un campo guardado hay que mantenerlo al día, y el día que nadie
lo actualice un recurso ya remediado seguirá apareciendo en rojo —o, peor, uno
incumplidor seguirá en verde—. Derivarlo quita ese trabajo y ese riesgo.

El orden importa: un hallazgo abierto manda sobre una etiqueta faltante,
porque lo primero que hay que atender es el incumplimiento.

## 16. El catálogo declara qué tipos admiten etiquetas

**Decisión.** `mappings.yaml` lista `tipos_etiquetables`, y tanto CO-TAG-01
como la API trabajan sobre esa lista.

**Por qué.** Al conectar el inventario, la VPC, la subred y el firewall
aparecieron como «Sin etiqueta» con las cinco claves faltantes. Es falso: esos
tipos **no exponen `labels` en la API de GCP**. La política ya hacía el
recorte, pero la API no, porque cada una tenía su propia lista.

Con la lista en el catálogo hay un solo origen, y
`scripts/verificar_catalogo.py` comprueba que las etiquetas obligatorias
coincidan en los cuatro sitios donde viven: catálogo, política, módulos de
Terraform y frontend.

## 17. Las identidades del pipeline las crea el arranque, no Terraform

**Decisión.** Las cuentas `ci-plan` y `ci-apply`, el pool de Workload Identity
y su proveedor OIDC los crea `scripts/bootstrap/gcp_pipeline.sh`, una vez y a
mano. `module "iam"` ya no crea la cuenta `tf-plan`.

**Por qué.** Es el huevo y la gallina: el pipeline necesita esas identidades
para correr su **primer** plan, así que no pueden ser recursos del mismo
Terraform que el pipeline aplica. Además, una cuenta que el pipeline pudiera
modificar sería una cuenta que el pipeline puede ampliarse a sí mismo. Pasa lo
mismo con el bucket del estado.

`ci-apply` lleva `roles/editor` y administradores de IAM, que `module "iam"`
rechaza. No es una contradicción: esa regla es para las cuentas de la
plataforma. La cuenta que aplica Terraform necesita crear lo que el código
declara, y a cambio solo la pueden usar jobs dentro del environment `dev` de
GitHub, que es donde vive la aprobación.

**Si se cambiara,** y las cuentas volvieran a Terraform, un ambiente nuevo no
podría desplegarse desde el pipeline, y un `terraform destroy` borraría la
identidad con la que se corre el propio destroy a mitad de camino.

## 18. El presupuesto usa un proveedor con alias, no el principal

**Decisión.** El módulo `costos` recibe un proveedor `google.facturacion` con
`user_project_override` y `billing_project`; el proveedor principal de
`environments/dev` se queda como estaba.

**Por qué.** La API de presupuestos exige un proyecto que pague su cuota: sin
`user_project_override` responde `403` aunque los permisos de facturación
estén bien. Lo directo sería ponerlo en el proveedor principal, y ahí está la
trampa: con esa opción **cada** llamada del proveedor exige
`serviceusage.services.use`, un permiso que `roles/viewer` no incluye. La
cuenta `ci-plan` del pipeline dejaría de poder planear **cualquier** recurso,
no solo el presupuesto. Acotarlo a un alias deja el resto del ambiente
intacto.

**Consecuencias.** El presupuesto es opcional (`count` sobre las variables de
facturación) y `terraform.tfvars.example` lo deja comentado: en cuanto se
define, cada `terraform plan` lo consulta y la cuenta que planea necesita
`roles/billing.viewer` sobre la cuenta de facturación. Ese permiso se otorga a
mano, porque un módulo de proyecto no puede concederse permisos sobre la
cuenta de facturación.

Y conviene no confundir lo que hace: un presupuesto de GCP **avisa, no apaga
nada**. Lo que corta el gasto sigue siendo destruir el ambiente al terminar
cada sesión.

## 19. El agente llama a Gemini con un rol de un solo permiso

**Decisión.** `app-agente` usa Gemini en Vertex AI con un rol personalizado,
`agenteLlamarModelo`, que solo concede `aiplatform.endpoints.predict`. Lo crea
`module "iam"`. No lleva `roles/aiplatform.user`.

**Por qué.** `roles/aiplatform.user` traía 469 permisos al 20 de noviembre de
2026: crear jobs de entrenamiento, endpoints, datasets y motores de agentes,
entre otros. El más chico de Google que deja llamar a un modelo
(`roles/aiplatform.expressUser`) también crea y borra datasets y sesiones. El
agente solo necesita pedir una respuesta, y CP-17 se sostiene en que su cuenta
no pueda crear ni cambiar nada.

Para que un rol personalizado no se vuelva la puerta trasera de los roles
prohibidos, la precondición de `module "iam"` y `CO-IAM-01` comparten una lista
de permisos que rechazan, además de cualquier `*.setIamPolicy`:

- Suplantar cuentas: `actAs`, `getAccessToken`, `signJwt` y parecidos.
- Crear, cambiar o recuperar roles.
- Las rutas conocidas que llegan a una cuenta con más permisos sin pedir
  `actAs`: el proveedor de Workload Identity, Deployment Manager, Cloud Build,
  las llaves HMAC y los metadatos de las VMs.

No es una lista completa de todo lo que permite escalar en GCP; cubre lo más
directo. Por eso las dos capas también rechazan asignar un rol personalizado
que el mismo código no define: uno creado a mano no pasó por esa revisión.

**Lo que cuesta:**

- `ci-apply` necesita `roles/iam.roleAdmin` para crear el rol, porque ni
  `roles/editor` ni los administradores de IAM incluyen `iam.roles.create`. No
  la amplía de verdad: con `roles/resourcemanager.projectIamAdmin` ya podía
  darse cualquier rol. **En un proyecto que ya existía, el dueño tiene que
  volver a correr `scripts/bootstrap/gcp_pipeline.sh` (es idempotente) antes
  del apply que crea el rol**, o el apply falla con `403 iam.roles.create`.
- GCP no borra un rol personalizado al momento. Durante 7 días se puede
  recuperar, y el proveedor de Terraform lo recupera solo si el ambiente se
  vuelve a crear en ese plazo. Después queda unos 30 días más sin poder reusar
  el id. Si dev se destruye y se recrea entre 7 y 37 días después, el apply
  falla al crear `agenteLlamarModelo`. La salida es cambiarle el id, por
  ejemplo `agenteLlamarModelo2`, en `environments/dev/main.tf`.

**Si se cambiara** a `roles/aiplatform.user`, una credencial del agente que se
filtrara podría lanzar trabajos que cuestan dinero y crear recursos que nadie
revisa, y CP-17 dejaría de ser cierto en la parte de "no puede crear nada".

## 20. La API y el frontend en Cloud Run son públicos; el acceso lo da el login

**Decisión.** Los servicios `api-mdc-dev` y `web-mdc-dev` dan `roles/run.invoker`
a `allUsers`. Quién puede ver y hacer qué lo decide la API con su login y sus
roles, no Cloud Run.

**Por qué.** El frontend corre en el navegador: si Cloud Run exigiera
identidad de Google en cada llamada, el navegador tendría que conseguir un
token de Google antes de llamar a la API, y eso es un proveedor de identidad
que el proyecto todavía no tiene. La alternativa que restringe el acceso a
ciertas cuentas, Identity-Aware Proxy, está por probarse en un proyecto sin
organización como `mdc-dev`.

**Lo que se acepta:**

- Mientras la API corre con `AUTH_MODO=local`, sus usuarios de demostración
  tienen una contraseña conocida. Cualquiera que tenga la URL puede entrar con
  ellos. Los datos son de ejemplo y viven en memoria, pero lo que esos usuarios
  registren llega al bucket de evidencia, que tiene retención: no se puede
  borrar antes de que venza.
- Por eso la API queda en una sola instancia y se apaga sola sin tráfico: el
  daño posible es acotado y lo que cobra también.

**Cuándo se cambia:** cuando la API tenga base de datos real. Ahí la propia
API exige `AUTH_MODO=jwks`, y los servicios pasan a Identity-Aware Proxy o a
un proveedor de identidad de verdad.

**Si se cambiara** a servicios privados sin resolver la identidad, el
dashboard dejaría de poder llamar a la API desde el navegador.

