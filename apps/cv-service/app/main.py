from fastapi import FastAPI

app = FastAPI(
    title="CV Service",
    description="Computer Vision service for face recognition and embedding extraction",
    version="0.1.0",
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "cv-service"}
