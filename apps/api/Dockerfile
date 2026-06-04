FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app

# 先复制pom.xml下载依赖，利用Docker层缓存
COPY pom.xml .
RUN mvn dependency:go-offline

# 复制全部源码编译
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/target/labelhub-api-0.1.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
