# 1. Builder Stage: Cache dependencies and package application
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /app

# Copy dependency descriptor and pre-fetch dependencies
COPY pom.xml ./
RUN mvn dependency:go-offline -B

# Copy source code and build artifact
COPY src ./src
RUN mvn clean package -DskipTests

# 2. Runner Stage: Lightweight JRE runtime
FROM eclipse-temurin:21-jre-alpine AS runner

WORKDIR /app

# Create non-root system user
RUN addgroup --system --gid 1001 spring && \
    adduser --system --uid 1001 --ingroup spring spring

# Copy JAR artifact from builder stage
COPY --from=builder --chown=spring:spring /app/target/*.jar app.jar

# JVM options optimized for container environment
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"
ENV PORT=8080

USER spring

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
