# Archive Software Documentation

## Overview

This directory contains comprehensive documentation for the Native American Languages Archive Software, including deployment guides, development setup, and operational procedures.

---

## Documentation Structure

### 📦 Deployment

Documentation for deploying and configuring the application in various environments.

- **[Database Operations](deployment/database-operations.md)** - Complete guide for database backup, restore, and management on TrueNAS Scale 25
  - Creating database dumps
  - Transferring between dev and production
  - Using the automated restore script
  - Manual procedures and troubleshooting
  - Nuclear option: complete reinstall

---

### 🛠️ Development

Guides and references for development environment setup and contributing to the project.

- **[Dependencies](dependencies.md)** - Required software and packages (legacy location - will migrate)

**Coming soon:**
- Development environment setup
- Architecture overview and design decisions
- Coding standards and patterns
- Testing guidelines

---

### 🎛️ System Behavior

Technical documentation of system logic, algorithms, and processing workflows.

- **[System Behavior](system-behavior/system-behavior.md)** - Technical documentation of system internals
  - Languoid hierarchy and automatic signal processing
  - **[Batch Editor](system-behavior/batch-editor/)** - Bulk data editing subsystem (TanStack + Redux)
- **[ADR: TanStack Migration](system-behavior/adr-tanstack-migration.md)** - Architecture Decision Record

---

### ⚙️ Operations

Day-to-day operational procedures and maintenance tasks.

**Related documentation:**
- **[Backup System](../backup/README.md)** - Automated daily backup system configuration and monitoring
- **[Update Procedures](../deploy-update-private.sh)** - Script for updating code on TrueNAS Scale

**Coming soon:**
- Troubleshooting common issues
- Performance monitoring and optimization
- Security best practices
- Disaster recovery procedures

---

## Quick Links

### Deployment Scripts

- **`deploy-restore-db-private.sh`** - Restore database on TrueNAS Scale ([docs](deployment/database-operations.md))
- **`deploy-update-private.sh`** - Update application code on TrueNAS Scale
- **`deploy.sh`** - Standard Docker Compose deployment (not for TrueNAS Scale)
- **`dev.sh`** - Start development environment

### Configuration Files

- **`.env`** - Environment variables (create from `env_example`)
- **`docker-compose.private.yml`** - Private server (TrueNAS Scale)
- **`docker-compose.public.yml`** - Public server configuration
- **`docker-compose.yml`** - Standard development deployment

### Key Directories

- **`app/`** - Django application code
- **`frontend/`** - React TypeScript frontend
- **`backup/`** - Database backups and restore files
- **`context/`** - Project context memory and architectural decisions
- **`nginx/`** - Nginx reverse proxy configuration

---

## Getting Started

### For Developers

1. Read the main [README.md](../README.md)
2. Set up your development environment (coming soon)
3. Review [Dependencies](dependencies.md)
4. Explore the [Context Memory](../context/) for architectural decisions

### For Operations/Deployment

1. **TrueNAS Scale Deployment:**
   - Follow [Database Operations Guide](deployment/database-operations.md)
   - Use `deploy-restore-db-private.sh` for database management
   - Use `deploy-update-private.sh` for code updates

2. **Standard Docker Deployment:**
   - Use `deploy.sh` with appropriate `.env` configuration
   - See main [README.md](../README.md) for basic setup

---

## Project Architecture

### Dual-Server Design

The Archive Software uses a sophisticated dual-server architecture:

- **Private Server** (TrueNAS Scale) - Complete archive with all files and metadata
- **Public Server** - Curated subset for public API access

**Key Features:**
- Seven storage volumes for security and data flow
- Virus scanning at multiple pipeline stages
- Event-driven database synchronization
- Cultural sensitivity-based access control (4 levels)

For detailed architecture decisions, see the [Context Memory](../context/core/architectural_decisions.json).

---

## Technology Stack

### Backend
- Django 5.0.14 (LTS)
- Django REST Framework
- PostgreSQL
- Celery + Redis
- Gunicorn

### Frontend
- React 18 + TypeScript
- Material-UI
- Redux Toolkit
- Axios

### Deployment
- Docker + Docker Compose
- TrueNAS Scale 25 Apps
- Nginx reverse proxy

---

## Cultural Context

This software serves the Native American Languages Archive at the Sam Noble Oklahoma Museum of Natural History, University of Oklahoma. All technical decisions must respect:

- **Cultural sensitivity** - Materials require graduated access control
- **Community control** - Indigenous communities maintain authority over their materials
- **Language preservation** - Supporting language revitalization efforts
- **Anonymous protection** - Some contributors require anonymity for cultural safety

See [Cultural Context](../context/domain/cultural_context.json) for more details.

---

## Contributing

We welcome contributions! Please:

1. Review the [Context Memory](../context/) to understand project history and decisions
2. Follow established coding patterns (see [Coding Patterns](../context/development/coding_patterns.json))
3. Respect preservation rules (see [Preservation Rules](../context/boundaries/preservation_rules.json))
4. Ensure ADA compliance for all UI changes
5. Test on multiple devices for responsive design

---

## Getting Help

### Documentation Issues

If you find documentation that is:
- Outdated
- Unclear
- Missing important information

Please update it! Documentation is code.

### Technical Issues

1. Check the [Context Memory](../context/) for architectural decisions
2. Review the [Technical Debt Registry](../context/evolution/technical_debt_registry.json)
3. Consult operation-specific guides in this docs directory

---

## License

AGPL-3.0 license

---

## Maintainers

This project is maintained by Kavon Hooshiar.

**Last Updated:** October 2025

