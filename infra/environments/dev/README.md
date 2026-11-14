# Ambiente `dev`

Composición de los ocho módulos para el mini data center de desarrollo.

## Qué despliega

Una VPC con subred privada, NAT y peering de servicios privados; firewall con
denegación por defecto; tres llaves CMEK con rotación de 90 días; cuatro
cuentas de servicio acotadas; un secreto para la contraseña de la base; una
instancia de Cloud SQL sin IP pública; dos VM de prueba sin IP pública; y el
bucket de evidencia con su sink de auditoría.

Son **dos** instancias porque las pruebas de red con iperf3 necesitan dos
extremos.

## Antes del primer despliegue

```bash
cp terraform.tfvars.example terraform.tfvars        # valores del proyecto
cp backend.tfbackend.example backend.tfbackend      # bucket del estado
terraform init -backend-config=backend.tfbackend
terraform plan
```

Ninguno de los dos archivos sin `.example` se versiona.

El bucket del estado debe existir antes: es el huevo y la gallina habitual del
estado remoto, y se crea una sola vez a mano.

## Particularidades de dev

- **La base no está protegida contra borrado.** La prueba de destruir y
  recrear (DEV-28) lo necesita. En producción una precondición impide
  desactivarla.
- **La retención del bucket no está bloqueada.** El bloqueo es irreversible y
  aquí solo estorbaría.
- **`clasificacion_datos` es `interno`.** Dev no debe recibir datos personales
  reales; si eso cambiara, cambia también el marco aplicable.

## Orden de creación

Las APIs se habilitan primero: sin ellas no existen los recursos ni los
agentes de servicio de GCP que usan las llaves CMEK. Después la red, porque
Cloud SQL con IP privada necesita el peering, y KMS, porque la base y los
discos se cifran con sus llaves.

Ese orden se declara con `depends_on` en cada llamada a módulo. Terraform
acepta un `depends_on` que apunte a una variable, pero no crea una dependencia
real: por eso el orden se declara aquí y no se pasa como dato.
