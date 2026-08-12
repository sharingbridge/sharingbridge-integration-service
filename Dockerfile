# syntax=docker/dockerfile:1
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
# Render injects PORT at runtime (not wired yet — production still Node via legacy-node)
EXPOSE 10000
COPY --from=build /src/target/sharingbridge-integration-service-*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
