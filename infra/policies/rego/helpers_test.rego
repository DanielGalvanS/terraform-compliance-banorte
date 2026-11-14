package main

# Mensajes de `deny` que pertenecen a un control concreto.
#
# Todas las políticas viven en `package main`, que es el espacio que conftest
# evalúa por defecto. Eso significa que un mismo plan de prueba puede disparar
# varias a la vez: una instancia de Cloud SQL sin etiquetas incumple CO-TAG-01
# aunque la prueba esté ejercitando CO-DB-01. Afirmar sobre `count(deny)` haría
# que cada política nueva rompiera las pruebas de las demás.
mensajes_de(control) := [msg |
	some msg in deny
	startswith(msg, control)
]
