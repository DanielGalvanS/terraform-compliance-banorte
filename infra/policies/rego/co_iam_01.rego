# CO-IAM-01 — Permisos de IAM excesivos.
#
# Un rol amplio a nivel de proyecto anula la segmentación de permisos: da lo
# mismo cuánto se acoten los demás accesos si una cuenta puede hacer todo. El
# módulo iam ya rechaza estos roles, pero la política cubre el caso de un
# recurso declarado fuera de un módulo aprobado.
package main

import data.lib

# Roles que conceden control amplio sobre el proyecto o permiten escalar
# privilegios hasta obtenerlo.
roles_excesivos := {
	"roles/owner",
	"roles/editor",
	"roles/iam.securityAdmin",
	"roles/iam.serviceAccountTokenCreator",
	"roles/resourcemanager.projectIamAdmin",
}

tipos_iam_proyecto := {
	"google_project_iam_member",
	"google_project_iam_binding",
}

deny contains msg if {
	some tipo in tipos_iam_proyecto
	some asignacion in lib.recursos_afectados(input, tipo)
	despues := asignacion.change.after
	despues.role in roles_excesivos

	msg := sprintf(
		"CO-IAM-01: '%s' concede el rol %s a nivel de proyecto. Usa un rol acotado al recurso que la cuenta necesita.",
		[asignacion.address, despues.role],
	)
}

# Una política de IAM completa a nivel de proyecto es aún peor: es autoritativa
# y reemplaza todo lo que haya, incluidos los agentes de servicio de GCP.
deny contains msg if {
	some politica in lib.recursos_afectados(input, "google_project_iam_policy")

	msg := sprintf(
		"CO-IAM-01: '%s' reemplaza la política de IAM completa del proyecto. Usa google_project_iam_member para añadir permisos sin borrar los existentes.",
		[politica.address],
	)
}
