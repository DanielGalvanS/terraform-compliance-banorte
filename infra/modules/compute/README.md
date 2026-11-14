# Módulo `compute`

Instancias de prueba sin IP pública, accesibles por IAP.

## Decisiones

- **Sin IP externa.** No hay bloque `access_config`, y eso es lo que elimina la
  dirección pública. La salida a internet va por Cloud NAT y la entrada por
  Identity-Aware Proxy.
- **Cuenta de servicio obligatoria.** Si no se indica una, GCP asigna la cuenta
  por defecto de Compute Engine, que viene con **rol de editor sobre el
  proyecto entero**. Una precondición impide dejarla vacía.
- **OS Login activo.** Liga el acceso SSH a identidades de IAM en vez de a
  llaves sueltas que nadie revoca cuando alguien deja el equipo. Con
  `block-project-ssh-keys` ninguna llave del proyecto abre estas instancias.
- **Shielded VM.** Arranque verificado y monitoreo de integridad detectan un
  arranque alterado que de otro modo pasaría inadvertido.
- **Varias instancias por diseño.** Las pruebas de red con iperf3 necesitan dos
  extremos: un cliente y un servidor. Con una sola VM no hay nada que medir.

## Uso

```hcl
module "compute" {
  source = "../../modules/compute"

  project_id      = var.project_id
  zona            = "us-central1-a"
  subred          = module.red.subred_id
  cuenta_servicio = module.iam.cuentas["app-pruebas"]
  llave_kms       = module.kms.llaves["discos"]
  etiquetas       = local.etiquetas_obligatorias

  instancias = {
    vm-mdc-dev-01 = {}
    vm-mdc-dev-02 = {}
  }
}
```
