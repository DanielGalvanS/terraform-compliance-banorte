# CO-SEC-01 — Secretos declarados en Terraform.
#
# El escáner del repositorio busca cadenas con pinta de secreto en los
# archivos. Este control mira otra cosa: campos del plan que, por su propia
# naturaleza, contienen un secreto en claro. Un valor que llegue por variable
# no aparece en el código fuente pero sí en el plan y en el estado.
package main

import data.lib

# Campos cuyo contenido es un secreto por definición.
campos_secretos := {
	"google_sql_user": "password",
	"google_secret_manager_secret_version": "secret_data",
	"google_service_account_key": "private_key",
}

deny contains msg if {
	some tipo, campo in campos_secretos
	some recurso in lib.recursos_afectados(input, tipo)
	valor := recurso.change.after[campo]
	tiene_valor(valor)

	msg := sprintf(
		"CO-SEC-01: '%s' declara %s en el plan. El valor quedaría en el estado en texto plano; cárgalo en Secret Manager fuera de Terraform.",
		[recurso.address, campo],
	)
}

# Un valor sensible que Terraform oculta sigue estando presente: aparece como
# marcado en after_sensitive aunque after no lo muestre.
deny contains msg if {
	some tipo, campo in campos_secretos
	some recurso in lib.recursos_afectados(input, tipo)
	recurso.change.after_sensitive[campo] == true
	not valor_visible(recurso.change.after, campo)

	msg := sprintf(
		"CO-SEC-01: '%s' declara %s como valor sensible. Terraform lo oculta en la salida, pero lo guarda en el estado.",
		[recurso.address, campo],
	)
}

tiene_valor(valor) if {
	is_string(valor)
	trim_space(valor) != ""
}

# El objeto y la clave se pasan por separado a propósito.
#
# `not tiene_valor(objeto[clave])` NO se cumple cuando la clave no existe: el
# argumento queda indefinido y con él toda la expresión, así que la negación
# tampoco se evalúa. Pasando el objeto, los argumentos siempre existen y la
# ausencia se resuelve dentro de la función.
valor_visible(despues, campo) if tiene_valor(despues[campo])
