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
