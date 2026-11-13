# fixtures

Planes de Terraform exportados a JSON, para probar la compuerta sin necesidad de
un proyecto de GCP.

Se generan así, una vez que exista el proyecto:

```bash
terraform plan -out=plan.bin
terraform show -json plan.bin > plan_conforme.json
```

Mientras tanto están escritos a mano, con la estructura que produce
`terraform show -json`: los cambios propuestos viven en `resource_changes`,
cada uno con su `type`, su `address` y el estado resultante en `change.after`.
