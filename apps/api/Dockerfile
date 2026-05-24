FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY apps/api/pom.xml apps/api/pom.xml
RUN mvn -f apps/api/pom.xml dependency:go-offline
COPY apps/api apps/api
RUN mvn -f apps/api/pom.xml clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/apps/api/target/labelhub-api-0.1.0.jar app.jar
COPY skills/ /app/skills/
COPY docs/contracts/ /app/docs/contracts/
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
