# Lightweight hexagonal architecture (backend rule)

Goal: keep business logic isolated from frameworks and infrastructure. Keep it simple.

## Layers

- **domain**: pure business concepts, rules, entities/value objects, domain services
- **application**: use cases, orchestration, ports/interfaces
- **infrastructure**: adapters for DB/HTTP/queues/external services, framework glue
- **presentation/interface**: controllers/handlers/routes, API DTOs

## Rules

1. `domain` must not import from `application`, `infrastructure`, `presentation`, or frameworks.
2. `application` may depend on `domain` and define ports, but must not depend on infrastructure adapters.
3. `infrastructure` implements application ports and may depend on external libraries/frameworks.
4. `presentation` calls application use cases; it must not contain business rules.
5. Dependencies point inward: `infrastructure/presentation → application → domain`.
6. Prefer simple modules and functions over heavy abstractions.
7. Create ports only when there is a real boundary (DB, external API, message broker, filesystem, clock, UUID generator, email/payments, etc.).
8. Do not create interfaces “just in case”.
9. DTOs stay at the edges; map them before entering `application/domain`.
10. Tests for `domain/application` should run without DB, HTTP server, or external services.
11. Framework-specific decorators/configuration should stay outside `domain` and ideally outside `application`.
12. If a business rule changes, the change should mostly happen in `domain/application`, not controllers or adapters.

Scrapers/crawlers/importers are infrastructure adapters. They must return clean import models through application ports and never leak scraper-specific details into `domain`.

## Default flow

`request → controller/handler → use case → port → adapter → external system`
