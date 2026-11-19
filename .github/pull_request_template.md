## Qué cambia
<!-- Una o dos frases. -->

## Por qué
<!-- Tarea de Jira (DEV-XX) o acuerdo que atiende. -->

Jira: DEV-

## Cómo lo probé
<!-- Comandos que corriste y su resultado. "Lo probé" no cuenta. -->
- [ ] `terraform fmt -check` y `terraform validate` (si toca `infra/`)
- [ ] `conftest verify --policy infra/policies/rego` (si toca políticas)
- [ ] `npm test` (si toca `apps/`)

## Riesgos
<!-- ¿Qué podría romper? ¿Necesita algo en GCP o en GitHub? Si nada, "Ninguno". -->

## Checklist
- [ ] Sin secretos, IDs de proyecto ni `.tfvars` en el diff
- [ ] Documentación actualizada si cambia el comportamiento
- [ ] Pedí revisión a alguien que no escribió el código
