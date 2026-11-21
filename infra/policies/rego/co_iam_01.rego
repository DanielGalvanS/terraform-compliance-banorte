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
	# Conceden en bloque permisos de permisos_excesivos.
	"roles/iam.roleAdmin",
	"roles/iam.serviceAccountUser",
	"roles/iam.serviceAccountKeyAdmin",
	"roles/iam.workloadIdentityPoolAdmin",
}

# Los permisos sueltos que hacen excesivos a esos roles. Sin esta lista, un rol
# personalizado los concedería sin que ningún rol amplio aparezca en el plan.
# Aparte se rechaza cualquier *.setIamPolicy. Es la misma lista que
# permisos_prohibidos en infra/modules/iam/variables.tf, donde se explica cada
# ruta; co_iam_01_test.rego comprueba que no se separen.
permisos_excesivos := {
	"iam.serviceAccounts.actAs",
	"iam.serviceAccounts.getAccessToken",
	"iam.serviceAccounts.getOpenIdToken",
	"iam.serviceAccounts.implicitDelegation",
	"iam.serviceAccounts.signBlob",
	"iam.serviceAccounts.signJwt",
	"iam.serviceAccountKeys.create",
	"iam.roles.create",
	"iam.roles.update",
	"iam.roles.undelete",
	"iam.workloadIdentityPoolProviders.create",
	"iam.workloadIdentityPoolProviders.update",
	"deploymentmanager.deployments.create",
	"cloudbuild.builds.create",
	"storage.hmacKeys.create",
	"compute.instances.setMetadata",
	"compute.projects.setCommonInstanceMetadata",
}

permiso_excesivo(permiso) if permiso in permisos_excesivos

permiso_excesivo(permiso) if endswith(permiso, ".setIamPolicy")

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

deny contains msg if {
	some rol in lib.recursos_afectados(input, "google_project_iam_custom_role")
	some permiso in rol.change.after.permissions
	permiso_excesivo(permiso)

	msg := sprintf(
		"CO-IAM-01: '%s' crea un rol personalizado con el permiso %s, que permite escalar privilegios. Deja en el rol solo los permisos que la cuenta usa.",
		[rol.address, permiso],
	)
}

# Si los permisos no se conocen al planear, no se pueden revisar: se bloquea en
# vez de dejarlo pasar.
deny contains msg if {
	some rol in lib.recursos_afectados(input, "google_project_iam_custom_role")
	rol.change.after_unknown.permissions == true

	msg := sprintf(
		"CO-IAM-01: '%s' crea un rol personalizado cuyos permisos no se conocen hasta aplicar. Escribe la lista de permisos de forma literal.",
		[rol.address],
	)
}

# Un rol personalizado se revisa donde se define. Asignar uno que este plan no
# define (creado a mano o en otro Terraform) se saltaría esa revisión.
rol_definido_en_el_plan(ruta) if {
	some rc in input.resource_changes
	rc.type == "google_project_iam_custom_role"
	rc.change.after != null
	ruta == sprintf("projects/%s/roles/%s", [rc.change.after.project, rc.change.after.role_id])
}

deny contains msg if {
	some tipo in tipos_iam_proyecto
	some asignacion in lib.recursos_afectados(input, tipo)
	rol := asignacion.change.after.role
	startswith(rol, "projects/")
	not rol_definido_en_el_plan(rol)

	msg := sprintf(
		"CO-IAM-01: '%s' asigna el rol personalizado %s, que este código no define y por eso nadie revisó sus permisos. Decláralo con google_project_iam_custom_role.",
		[asignacion.address, rol],
	)
}
