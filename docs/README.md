# Documentation

Start with the [repository README](../README.md) to run the application.
These guides describe the current implementation.

| Guide | Use it to |
| --- | --- |
| [Contributing](CONTRIBUTING.md) | Propose changes and run the required checks |
| [Security](SECURITY.md) | Report vulnerabilities privately and understand supported versions |
| [Operator content](content.md) | Use your own texts, name, footer and logos |
| [Deployment](deployment.md) | Build or pull the container, configure and operate it |
| [Development](development.md) | Install dependencies, run checks, and exercise the UI |
| [Architecture](architecture.md) | Understand module responsibilities, scoring, and state ownership |
| [HTTP API](api.md) | Understand request shapes, responses, and failure behavior |
| [AI content](ai/README.md) | Understand the advice prompt and reply protocol |
| [Dependency maintenance](dependencies.md) | Update dependencies and review audit results |
| [Data sources](../src/data/README.md) | Sources and terms of the municipal data |
| [Agent instructions](../AGENTS.md) | Follow repository conventions during coding work |

## Documentation policy

Write developer explanations in English and runtime AI content in German.
Preserve German displayed labels and protocol literals when exact spelling
matters. Keep question wording and scoring definitions in the code that owns
them; link to that code instead of copying the full questionnaire into a second
specification. Update the relevant guide when behavior changes.
