# Módulo `firewall`

Reglas de entrada con denegación por defecto y SSH solo a través de
Identity-Aware Proxy.

## Decisiones

- **Denegación explícita.** GCP ya deniega por defecto, pero esa regla implícita
  no aparece en el `terraform plan` y por tanto no es auditable. Declararla deja
  constancia en la evidencia y habilita sus logs.
- **SSH solo desde `35.235.240.0/20`.** Es el rango de IAP, público y fijo. Así
  nadie necesita una IP pública ni un bastión, y el puerto 22 jamás queda
  expuesto a internet, que es lo que rechaza CO-NET-01.
- **Tráfico interno acotado a puertos declarados.** Abrir la subred completa a
  todos los protocolos es justo lo que rechaza CO-NET-02.
- **ICMP interno solo si se pide.** `permitir_icmp_interno` abre ping dentro de
  la subred, para medir latencia en las pruebas de rendimiento. Está apagado por
  defecto y nunca se abre desde internet.
- **Logging en todas las reglas.** Sin logs no hay evidencia de qué se permitió.

## Uso

```hcl
module "firewall" {
  source = "../../modules/firewall"

  project_id  = var.project_id
  red         = module.red.red_nombre
  nombre      = "mdc-dev"
  subred_cidr = module.red.subred_cidr
}
```

La instancia que deba aceptar SSH necesita la etiqueta de red que expone el
output `etiqueta_ssh`.
