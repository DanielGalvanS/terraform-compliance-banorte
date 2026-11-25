package main

asignacion_iam(tipo, rol) := {"resource_changes": [{
	"address": sprintf("%s.prueba", [tipo]),
	"type": tipo,
	"change": {
		"actions": ["create"],
		"after": {
			"role": rol,
			"member": "serviceAccount:app@proyecto.iam.gserviceaccount.com",
		},
	},
}]}

test_rechaza_owner if {
	entrada := asignacion_iam("google_project_iam_member", "roles/owner")
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

test_rechaza_editor if {
	entrada := asignacion_iam("google_project_iam_member", "roles/editor")
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

test_rechaza_suplantacion_de_cuentas if {
	entrada := asignacion_iam("google_project_iam_member", "roles/iam.serviceAccountTokenCreator")
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

test_rechaza_binding_con_rol_amplio if {
	entrada := asignacion_iam("google_project_iam_binding", "roles/editor")
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

test_rechaza_politica_completa_del_proyecto if {
	entrada := {"resource_changes": [{
		"address": "google_project_iam_policy.todo",
		"type": "google_project_iam_policy",
		"change": {"actions": ["create"], "after": {"policy_data": "{}"}},
	}]}
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

test_permite_rol_acotado if {
	entrada := asignacion_iam("google_project_iam_member", "roles/logging.logWriter")
	count(mensajes_de("CO-IAM-01")) == 0 with input as entrada
}

test_permite_solo_lectura if {
	entrada := asignacion_iam("google_project_iam_member", "roles/viewer")
	count(mensajes_de("CO-IAM-01")) == 0 with input as entrada
}

rol_personalizado(permisos) := {"resource_changes": [{
	"address": "google_project_iam_custom_role.prueba",
	"type": "google_project_iam_custom_role",
	"change": {
		"actions": ["create"],
		"after": {"role_id": "prueba", "permissions": permisos},
	},
}]}

test_rechaza_rol_personalizado_que_cambia_iam if {
	entrada := rol_personalizado(["aiplatform.endpoints.predict", "resourcemanager.projects.setIamPolicy"])
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

test_rechaza_rol_personalizado_que_suplanta_cuentas if {
	entrada := rol_personalizado(["iam.serviceAccounts.getAccessToken"])
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

test_un_mensaje_por_permiso_excesivo if {
	entrada := rol_personalizado(["iam.roles.create", "storage.buckets.setIamPolicy"])
	count(mensajes_de("CO-IAM-01")) == 2 with input as entrada
}

test_permite_rol_personalizado_acotado if {
	entrada := rol_personalizado(["aiplatform.endpoints.predict"])
	count(mensajes_de("CO-IAM-01")) == 0 with input as entrada
}

test_rechaza_rol_personalizado_que_toca_metadatos_de_vms if {
	entrada := rol_personalizado(["compute.instances.setMetadata"])
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

test_rechaza_rol_personalizado_con_permisos_desconocidos if {
	entrada := {"resource_changes": [{
		"address": "google_project_iam_custom_role.prueba",
		"type": "google_project_iam_custom_role",
		"change": {
			"actions": ["create"],
			"after": {"role_id": "prueba", "project": "p"},
			"after_unknown": {"permissions": true},
		},
	}]}
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

test_rechaza_roles_que_conceden_permisos_excesivos if {
	entrada := asignacion_iam("google_project_iam_member", "roles/iam.serviceAccountUser")
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

asignacion_personalizada(rol, rol_definido) := {"resource_changes": array.concat(
	[{
		"address": "google_project_iam_member.agente",
		"type": "google_project_iam_member",
		"change": {"actions": ["create"], "after": {"project": "p", "role": rol, "member": "serviceAccount:a@p.iam.gserviceaccount.com"}},
	}],
	[{
		"address": "google_project_iam_custom_role.agente",
		"type": "google_project_iam_custom_role",
		# no-op: el rol ya existe y este plan no lo cambia; sigue estando definido.
		"change": {"actions": ["no-op"], "after": {"project": "p", "role_id": rol_definido, "permissions": ["aiplatform.endpoints.predict"]}},
	}],
)}

test_permite_asignar_un_rol_personalizado_definido if {
	entrada := asignacion_personalizada("projects/p/roles/agente", "agente")
	count(mensajes_de("CO-IAM-01")) == 0 with input as entrada
}

test_rechaza_asignar_un_rol_personalizado_que_no_define if {
	entrada := asignacion_personalizada("projects/p/roles/creadoAMano", "agente")
	count(mensajes_de("CO-IAM-01")) == 1 with input as entrada
}

# Alarma, no comparación: las listas viven también en
# infra/modules/iam/variables.tf, y si se separan una capa deja pasar lo que la
# otra bloquea. Quien cambie una lista tiene que cambiar este número y, con él,
# la otra lista.
test_cambiar_una_lista_obliga_a_revisar_la_del_modulo if {
	count(permisos_excesivos) == 17
	count(roles_excesivos) == 9
}
