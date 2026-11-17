# Specification Quality Checklist: Cambiar el estado de una incidencia (directiva)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-15
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- El input nombra el endpoint (`PUT /api/incidencias/{id}`) y la tabla; la spec habla de "cambiar el estado" y deja el contrato para `contracts/`. Los códigos 401/403/404 de la US3 y los casos límite se mantienen porque son el comportamiento observable acordado.
- Estados y regla "solo hacia delante": tomados de `docs/producto.md`; Rafa los confirma en el hilo (tarjeta de decisión) en lugar de con [NEEDS CLARIFICATION].
