# Utilidades compartidas por las políticas.
#
# Conftest evalúa el JSON que produce `terraform show -json plan.out`. Los
# cambios propuestos viven en `resource_changes`; cada entrada trae el tipo de
# recurso, su dirección y el estado resultante en `change.after`.
package lib

# Recursos que el plan va a crear o modificar. Se excluyen los que solo se
# destruyen: un recurso que desaparece no puede violar un control.
recursos_afectados(entrada, tipo) := [rc |
	some rc in entrada.resource_changes
	rc.type == tipo
	rc.change.after != null
	acciones_relevantes(rc.change.actions)
]

acciones_relevantes(acciones) if "create" in acciones

acciones_relevantes(acciones) if "update" in acciones

# Un origen abierto a todo internet, en IPv4 o IPv6.
abierto_a_internet(rango) if rango == "0.0.0.0/0"

abierto_a_internet(rango) if rango == "::/0"
