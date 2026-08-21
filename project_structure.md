# Cấu trúc dự án

```txt
(project_root)/
├── .github/
│   └── workflows/
├── apps/
│   ├── frontend/                   # Next.js Client App
│   │   ├── src/
│   │   ├── public/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── backend/                    # Spring Boot Monolith
│   │   ├── src/
│   │   ├── Dockerfile
│   │   ├── pom.xml
│   │   └── mvnw
│   └── cv-service/                 # Python CV Inference Service
│       ├── app/
│       ├── weights/                # Pre-trained model weights (git-ignored)
│       ├── Dockerfile
│       └── requirements.txt
├── docker/
│   ├── postgres/
│   │   └── init.sql
│   └── minio/
│       └── init.sh
├── docs/                           # Project specs & diagrams
├── .gitignore
├── docker-compose.yml
└── README.md
```
